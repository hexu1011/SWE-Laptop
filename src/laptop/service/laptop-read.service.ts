// Copyright (C) 2016 - present Juergen Zimmermann, Hochschule Karlsruhe
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program. If not, see <https://www.gnu.org/licenses/>.

/**
 * Das Modul besteht aus der Klasse {@linkcode LaptopReadService}.
 * @packageDocumentation
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { getLogger } from '../../logger/logger.js';
import { LaptopDatei } from '../entity/laptopDatei.entity.js';
import { Laptop } from '../entity/laptop.entity.js';
import { type Pageable } from './pageable.js';
import { type Slice } from './slice.js';
import { QueryBuilder } from './query-builder.js';
import { type Suchkriterien } from './suchkriterien.js';

/**
 * Typdefinition für `findById`
 */
export type FindByIdParams = {
    /** ID des gesuchten Buchs */
    readonly id: number;
    /** Sollen die Abbildungen mitgeladen werden? */
    readonly mitLaptopBilden?: boolean;
};

/**
 * Die Klasse `LaptopReadService` implementiert das Lesen für Laptops und greift
 * mit _TypeORM_ auf eine relationale DB zu.
 */
@Injectable()
export class LaptopReadService {
    static readonly ID_PATTERN = /^[1-9]\d{0,10}$/u;

    readonly #laptopProps: string[];

    readonly #queryBuilder: QueryBuilder;

    readonly #dateiRepo: Repository<LaptopDatei>;

    readonly #logger = getLogger(LaptopReadService.name);

    constructor(
        queryBuilder: QueryBuilder,
        @InjectRepository(LaptopDatei) dateiRepo: Repository<LaptopDatei>,
    ) {
        const laptopDummy = new Laptop();
        this.#laptopProps = Object.getOwnPropertyNames(laptopDummy);
        this.#queryBuilder = queryBuilder;
        this.#dateiRepo = dateiRepo;
    }

    // Rueckgabetyp Promise bei asynchronen Funktionen
    //    ab ES2015
    //    vergleiche Task<> bei C#
    // Status eines Promise:
    //    Pending: das Resultat ist noch nicht vorhanden, weil die asynchrone
    //             Operation noch nicht abgeschlossen ist
    //    Fulfilled: die asynchrone Operation ist abgeschlossen und
    //               das Promise-Objekt hat einen Wert
    //    Rejected: die asynchrone Operation ist fehlgeschlagen and das
    //              Promise-Objekt wird nicht den Status "fulfilled" erreichen.
    //              Im Promise-Objekt ist dann die Fehlerursache enthalten.

    /**
     * Ein Laptop asynchron anhand seiner ID suchen
     * @param id ID des gesuchten Laptops
     * @returns Das gefundene Laptop in einem Promise aus ES2015.
     * @throws NotFoundException falls kein Laptop mit der ID existiert
     */
    // https://2ality.com/2015/01/es6-destructuring.html#simulating-named-parameters-in-javascript
    async findById({
        id,
        mitLaptopBilden = false,
    }: FindByIdParams): Promise<Readonly<Laptop>> {
        this.#logger.debug('findById: id=%d', id);

        // https://typeorm.io/working-with-repository
        // Das Resultat ist undefined, falls kein Datensatz gefunden
        // Lesen: Keine Transaktion erforderlich
        const laptop = await this.#queryBuilder
            .buildId({ id, mitLaptopBilden })
            .getOne();
        if (laptop === null) {
            throw new NotFoundException(`Es gibt kein Laptop mit der ID ${id}.`);
        }
        if (laptop.merkmale === null) {
            laptop.merkmale = [];
        }

        if (this.#logger.isLevelEnabled('debug')) {
            this.#logger.debug(
                'findById: laptop=%s, marke=%o',
                laptop.toString(),
                laptop.marke,
            );
            if (mitLaptopBilden) {
                this.#logger.debug(
                    'findById: LaptopBilden=%o',
                    laptop.laptopBilden,
                );
            }
        }
        return laptop;
    }

    /**
     * Binärdatei zu einem Laptop suchen.
     * @param laptopId ID des zugehörigen Laptops.
     * @returns Binärdatei oder undefined als Promise.
     */
    async findFileByLaptopId(
        laptopId: number,
    ): Promise<Readonly<LaptopDatei> | undefined> {
        this.#logger.debug('findFileByLaptopId: buchId=%s', laptopId);
        const laptopDatei = await this.#dateiRepo
            .createQueryBuilder('laptop_datei')
            .where('laptop_id = :id', { id: laptopId })
            .getOne();
        if (laptopDatei === null) {
            this.#logger.debug('findFileByLaptopId: Keine Datei gefunden');
            return;
        }

        this.#logger.debug('findFileByLaptopId: filename=%s', laptopDatei.filename);
        return laptopDatei;
    }

    /**
     * Laptops asynchron suchen.
     * @param suchkriterien JSON-Objekt mit Suchkriterien.
     * @param pageable Maximale Anzahl an Datensätzen und Seitennummer.
     * @returns Ein JSON-Array mit den gefundenen Laptops.
     * @throws NotFoundException falls keine Laptops gefunden wurden.
     */
    async find(
        suchkriterien: Suchkriterien | undefined,
        pageable: Pageable,
    ): Promise<Slice<Laptop>> {
        this.#logger.debug(
            'find: suchkriterien=%o, pageable=%o',
            suchkriterien,
            pageable,
        );

        // Keine Suchkriterien?
        if (suchkriterien === undefined) {
            return await this.#findAll(pageable);
        }
        const keys = Object.keys(suchkriterien);
        if (keys.length === 0) {
            return await this.#findAll(pageable);
        }

        // Falsche Namen fuer Suchkriterien?
        if (!this.#checkKeys(keys) || !this.#checkEnums(suchkriterien)) {
            throw new NotFoundException('Ungueltige Suchkriterien');
        }

        // QueryBuilder https://typeorm.io/select-query-builder
        // Das Resultat ist eine leere Liste, falls nichts gefunden
        // Lesen: Keine Transaktion erforderlich
        const queryBuilder = this.#queryBuilder.build(suchkriterien, pageable);
        const laptops = await queryBuilder.getMany();
        if (laptops.length === 0) {
            this.#logger.debug('find: Keine Laptops gefunden');
            throw new NotFoundException(
                `Keine Laptops gefunden: ${JSON.stringify(suchkriterien)}, Seite ${pageable.number}}`,
            );
        }
        const totalElements = await queryBuilder.getCount();
        return this.#createSlice(laptops, totalElements);
    }

    async #findAll(pageable: Pageable) {
        const queryBuilder = this.#queryBuilder.build({}, pageable);
        const laptops = await queryBuilder.getMany();
        if (laptops.length === 0) {
            throw new NotFoundException(`Ungueltige Seite "${pageable.number}"`);
        }
        const totalElements = await queryBuilder.getCount();
        return this.#createSlice(laptops, totalElements);

    }

    #createSlice(laptops: Laptop[], totalElements: number) {
        laptops.forEach((laptop) => {
            if (laptop.merkmale === null) {
                laptop.merkmale = [];
            }
        });
        const laptopSlice: Slice<Laptop> = {
            content: laptops,
            totalElements,
        };
        this.#logger.debug('createSlice: laptopSlice=%o', laptopSlice);
        return laptopSlice;
    }

    #checkKeys(keys: string[]) {
        this.#logger.debug('#checkKeys: keys=%s', keys);
        // Ist jedes Suchkriterium auch eine Property von Laptop oder "merkmale"?
        let validKeys = true;
        keys.forEach((key) => {
            if (
                !this.#laptopProps.includes(key) &&
                key !== 'touchscreen' &&
                key !== 'backlit' &&
                key !== 'lightweight' &&
                key !== 'battery'
            ) {
                this.#logger.debug(
                    '#checkKeys: ungueltiges Suchkriterium "%s"',
                    key,
                );
                validKeys = false;
            }
        });

        return validKeys;
    }

    #checkEnums(suchkriterien: Suchkriterien) {
        const { art } = suchkriterien;
        this.#logger.debug('#checkEnums: Suchkriterium "art=%s"', art);
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        return (
            art === undefined ||
            art === 'ULTRABOOK' ||
            art === 'GAMING' ||
            art === 'BUSINESS'
        );
    }
}

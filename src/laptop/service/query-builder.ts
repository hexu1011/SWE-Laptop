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
 * Das Modul besteht aus der Klasse {@linkcode QueryBuilder}.
 * @packageDocumentation
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { typeOrmModuleOptions } from '../../config/typeormOptions.js';
import { getLogger } from '../../logger/logger.js';
import { LaptopBild } from '../entity/laptopBild.entity.js';
import { Laptop } from '../entity/laptop.entity.js';
import { DEFAULT_PAGE_NUMBER, DEFAULT_PAGE_SIZE } from './pageable.js';
import { type Pageable } from './pageable.js';
import { Marke } from '../entity/marke.entity.js';
import { type Suchkriterien } from './suchkriterien.js';

/** Typdefinitionen für die Suche mit der Laptop-ID. */
export type BuildIdParams = {
    /** ID des gesuchten Laptops. */
    readonly id: number;
    /** Sollen die Laptopbilden mitgeladen werden? */
    readonly mitLaptopBilden?: boolean;
};
/**
 * Die Klasse `QueryBuilder` implementiert das Lesen für Laptops und greift
 * mit _TypeORM_ auf eine relationale DB zu.
 */
@Injectable()
export class QueryBuilder {
    readonly #laptopAlias = `${Laptop.name
        .charAt(0)
        .toLowerCase()}${Laptop.name.slice(1)}`;

    readonly #markeAlias = `${Marke.name
        .charAt(0)
        .toLowerCase()}${Marke.name.slice(1)}`;

    readonly #laptopBildAlias = `${LaptopBild.name
        .charAt(0)
        .toLowerCase()}${LaptopBild.name.slice(1)}`;

    readonly #repo: Repository<Laptop>;

    readonly #logger = getLogger(QueryBuilder.name);

    constructor(@InjectRepository(Laptop) repo: Repository<Laptop>) {
        this.#repo = repo;
    }

    /**
     * Ein Laptop mit der ID suchen.
     * @param id ID des gesuchten Laptops
     * @returns QueryBuilder
     */
    buildId({ id, mitLaptopBilden = false }: BuildIdParams) {
        // QueryBuilder "laptop" fuer Repository<Laptop>
        const queryBuilder = this.#repo.createQueryBuilder(this.#laptopAlias);

        // Fetch-Join: aus QueryBuilder "laptop" die Property "marke" ->  Tabelle "marke"
        queryBuilder.innerJoinAndSelect(
            `${this.#laptopAlias}.marke`,
            this.#markeAlias,
        );

        if (mitLaptopBilden) {
            // Fetch-Join: aus QueryBuilder "laptop" die Property "bilden" -> Tabelle "bilden"
            queryBuilder.leftJoinAndSelect(
                `${this.#laptopAlias}.laptopBilden`,
                this.#laptopBildAlias,
            );
        }

        queryBuilder.where(`${this.#laptopAlias}.id = :id`, { id: id }); // eslint-disable-line object-shorthand
        return queryBuilder;
    }

    /**
     * Bücher asynchron suchen.
     * @param suchkriterien JSON-Objekt mit Suchkriterien. Bei "marke" wird mit
     * einem Teilstring gesucht, bei "preis"
     * mit der Obergrenze.
     * @param pageable Maximale Anzahl an Datensätzen und Seitennummer.
     * @returns QueryBuilder
     */
    // z.B. { marke: 'a', preis: 22.5, touchscreen: true }
    // "rest properties" fuer anfaengliche WHERE-Klausel: ab ES 2018 https://github.com/tc39/proposal-object-rest-spread
    // eslint-disable-next-line max-lines-per-function, prettier/prettier, sonarjs/cognitive-complexity
    build(
        {
            // NOSONAR
            marke,
            preis,
            touchscreen,
            backlit,
            lightweight,
            battery,
            ...restProps
        }: Suchkriterien,
        pageable: Pageable,
    ) {
        this.#logger.debug(
            'build: marke=%s, preis=%s, javascript=%s, typescript=%s, java=%s, python=%s, restProps=%o, pageable=%o',
            marke,
            preis,
            touchscreen,
            backlit,
            lightweight,
            battery,
            restProps,
            pageable,
        );

        let queryBuilder = this.#repo.createQueryBuilder(this.#laptopAlias);
        queryBuilder.innerJoinAndSelect(`${this.#laptopAlias}.marke`, 'marke');

        // z.B. { marke: 'a', javascript: true }
        // "rest properties" fuer anfaengliche WHERE-Klausel: ab ES 2018 https://github.com/tc39/proposal-object-rest-spread
        // type-coverage:ignore-next-line
        // const { marke, javascript, typescript, ...otherProps } = suchkriterien;

        let useWhere = true;

        // Marke in der Query: Teilstring des markes und "case insensitive"
        // CAVEAT: MySQL hat keinen Vergleich mit "case insensitive"
        // type-coverage:ignore-next-line
        if (marke !== undefined && typeof marke === 'string') {
            const ilike =
                typeOrmModuleOptions.type === 'postgres' ? 'ilike' : 'like';
            queryBuilder = queryBuilder.where(
                `${this.#markeAlias}.marke ${ilike} :marke`,
                { marke: `%${marke}%` },
            );
            useWhere = false;
        }

        if (preis !== undefined && typeof preis === 'string') {
            const preisNumber = Number(preis);
            queryBuilder = queryBuilder.where(
                `${this.#laptopAlias}.preis <= ${preisNumber}`,
            );
            useWhere = false;
        }

        if (touchscreen === 'true') {
            queryBuilder = useWhere
                ? queryBuilder.where(
                      `${this.#laptopAlias}.merkmale like '%TOUCHSCREEN%'`,
                  )
                : queryBuilder.andWhere(
                      `${this.#laptopAlias}.merkmale like '%TOUCHSCREEN%'`,
                  );
            useWhere = false;
        }

        if (backlit === 'true') {
            queryBuilder = useWhere
                ? queryBuilder.where(
                      `${this.#laptopAlias}.merkmale like '%BACKLIT%'`,
                  )
                : queryBuilder.andWhere(
                      `${this.#laptopAlias}.merkmale like '%BACKLIT%'`,
                  );
            useWhere = false;
        }

        if (lightweight === 'true') {
            queryBuilder = useWhere
                ? queryBuilder.where(
                      `${this.#laptopAlias}.merkmale like '%LIGHTWEIGHT%'`,
                  )
                : queryBuilder.andWhere(
                      `${this.#laptopAlias}.merkmale like '%LIGHTWEIGHT%'`,
                  );
            useWhere = false;
        }

        if (battery === 'true') {
            queryBuilder = useWhere
                ? queryBuilder.where(
                      `${this.#laptopAlias}.merkmale like '%BATTERY%'`,
                  )
                : queryBuilder.andWhere(
                      `${this.#laptopAlias}.merkmale like '%BATTERY%'`,
                  );
            useWhere = false;
        }

        // Restliche Properties als Key-Value-Paare: Vergleiche auf Gleichheit
        Object.entries(restProps).forEach(([key, value]) => {
            const param: Record<string, any> = {};
            param[key] = value; // eslint-disable-line security/detect-object-injection
            queryBuilder = useWhere
                ? queryBuilder.where(
                      `${this.#laptopAlias}.${key} = :${key}`,
                      param,
                  )
                : queryBuilder.andWhere(
                      `${this.#laptopAlias}.${key} = :${key}`,
                      param,
                  );
            useWhere = false;
        });

        this.#logger.debug('build: sql=%s', queryBuilder.getSql());

        if (pageable?.size === 0) {
            return queryBuilder;
        }
        const size = pageable?.size ?? DEFAULT_PAGE_SIZE;
        const number = pageable?.number ?? DEFAULT_PAGE_NUMBER;
        const skip = number * size;
        this.#logger.debug('take=%s, skip=%s', size, skip);
        return queryBuilder.take(size).skip(skip);
    }
}

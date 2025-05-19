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
 * Das Modul besteht aus der Klasse {@linkcode LaptopWriteService} für die
 * Schreiboperationen im Anwendungskern.
 * @packageDocumentation
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type DeleteResult, Repository } from 'typeorm';
import { getLogger } from '../../logger/logger.js';
import { MailService } from '../../mail/mail.service.js';
import { LaptopBild } from '../entity/laptopBild.entity.js';
import { Laptop } from '../entity/laptop.entity.js';
import { LaptopDatei } from '../entity/laptopDatei.entity.js';
import { Marke } from '../entity/marke.entity.js';
import { LaptopReadService } from './laptop-read.service.js';
import {
    ModellnrExistsException,
    VersionInvalidException,
    VersionOutdatedException,
} from './exceptions.js';

/** Typdefinitionen zum Aktualisieren eines Laptops mit `update`. */
export type UpdateParams = {
    /** ID des zu aktualisierenden Laptops. */
    readonly id: number | undefined;
    /** Laptop-Objekt mit den aktualisierten Werten. */
    readonly laptop: Laptop;
    /** Versionsnummer für die aktualisierenden Werte. */
    readonly version: string;
};

// TODO Transaktionen, wenn mehr als 1 TypeORM-Schreibmethode involviert ist
// https://docs.nestjs.com/techniques/database#typeorm-transactions
// https://papooch.github.io/nestjs-cls/plugins/available-plugins/transactional
// https://betterprogramming.pub/handling-transactions-in-typeorm-and-nest-js-with-ease-3a417e6ab5
// https://bytesmith.dev/blog/20240320-nestjs-transactions

/**
 * Die Klasse `LaptopWriteService` implementiert den Anwendungskern für das
 * Schreiben von Bücher und greift mit _TypeORM_ auf die DB zu.
 */
@Injectable()
export class LaptopWriteService {
    private static readonly VERSION_PATTERN = /^"\d{1,3}"/u;

    readonly #repo: Repository<Laptop>;

    readonly #dateiRepo: Repository<LaptopDatei>;

    readonly #readService: LaptopReadService;

    readonly #mailService: MailService;

    readonly #logger = getLogger(LaptopWriteService.name);

    // eslint-disable-next-line max-params
    constructor(
        @InjectRepository(Laptop) repo: Repository<Laptop>,
        @InjectRepository(LaptopDatei) dateiRepo: Repository<LaptopDatei>,
        readService: LaptopReadService,
        mailService: MailService,
    ) {
        this.#repo = repo;
        this.#dateiRepo = dateiRepo;
        this.#readService = readService;
        this.#mailService = mailService;
    }

    /**
     * Ein neues Laptop soll angelegt werden.
     * @param laptop Das neu abzulegende Laptop
     * @returns Die ID des neu angelegten Laptops
     * @throws ModellnrExists falls die modellnummer bereits existiert
     */
    async create(laptop: Laptop) {
        this.#logger.debug('create: laptop=%o', laptop);
        await this.#validateCreate(laptop);

        const laptopDb = await this.#repo.save(laptop); // implizite Transaktion
        await this.#sendmail(laptopDb);

        return laptopDb.id!;
    }

    /**
     * Zu einem vorhandenen Laptop ein Binärdatei mit z.B. einem Bild abspeichern.
     * @param laptopId ID des vorhandenen laptops
     * @param data Bytes der Datei
     * @param filename Dateiname
     * @param mimetype MIME-Type
     * @returns Entity-Objekt für `LaptopDatei`
     */
    // eslint-disable-next-line max-params
    async addFile(
        laptopId: number,
        data: Buffer,
        filename: string,
        mimetype: string,
    ): Promise<Readonly<LaptopDatei>> {
        this.#logger.debug(
            'addDatei: laptopId: %d, filename:%s, mimetype: %s',
            laptopId,
            filename,
            mimetype,
        );

        // Laptop ermitteln, falls vorhanden
        const laptop = await this.#readService.findById({ id: laptopId });

        // evtl. vorhandene Datei loeschen
        await this.#dateiRepo
            .createQueryBuilder('laptop_datei')
            .delete()
            .where('laptop_id = :id', { id: laptopId })
            .execute();

        // Entity-Objekt aufbauen, um es spaeter in der DB zu speichern (s.u.)
        const laptopDatei = this.#dateiRepo.create({
            filename,
            data,
            mimetype,
            laptop,
        });

        // Den Datensatz fuer Laptop mit der neuen Binaerdatei aktualisieren
        await this.#repo.save({
            id: laptop.id,
            file: laptopDatei,
        });

        return laptopDatei;
    }

    /**
     * Ein vorhandenes Laptop soll aktualisiert werden. "Destructured" Argument
     * mit id (ID des zu aktualisierenden Laptops), laptop (zu aktualisierendes Laptop)
     * und version (Versionsnummer für optimistische Synchronisation).
     * @returns Die neue Versionsnummer gemäß optimistischer Synchronisation
     * @throws NotFoundException falls kein laptop zur ID vorhanden ist
     * @throws VersionInvalidException falls die Versionsnummer ungültig ist
     * @throws VersionOutdatedException falls die Versionsnummer veraltet ist
     */
    // https://2ality.com/2015/01/es6-destructuring.html#simulating-named-parameters-in-javascript
    async update({ id, laptop, version }: UpdateParams) {
        this.#logger.debug(
            'update: id=%d, laptop=%o, version=%s',
            id,
            laptop,
            version,
        );
        if (id === undefined) {
            this.#logger.debug('update: Keine gueltige ID');
            throw new NotFoundException(
                `Es gibt kein Laptop mit der ID ${id}.`,
            );
        }

        const validateResult = await this.#validateUpdate(laptop, id, version);
        this.#logger.debug('update: validateResult=%o', validateResult);
        if (!(validateResult instanceof Laptop)) {
            return validateResult;
        }

        const laptopNeu = validateResult;
        const merged = this.#repo.merge(laptopNeu, laptop);
        this.#logger.debug('update: merged=%o', merged);
        const updated = await this.#repo.save(merged); // implizite Transaktion
        this.#logger.debug('update: updated=%o', updated);

        return updated.version!;
    }

    /**
     * Ein Laptop wird asynchron anhand seiner ID gelöscht.
     *
     * @param id ID des zu löschenden Laptops
     * @returns true, falls das Laptop vorhanden war und gelöscht wurde. Sonst false.
     */
    async delete(id: number) {
        this.#logger.debug('delete: id=%d', id);
        const laptop = await this.#readService.findById({
            id,
            mitLaptopBilden: true,
        });

        let deleteResult: DeleteResult | undefined;
        await this.#repo.manager.transaction(async (transactionalMgr) => {
            // Der Laptop zur gegebenen ID mit marke und Bild. asynchron loeschen

            // TODO "cascade" funktioniert nicht beim Loeschen
            const markeId = laptop.marke?.id;
            if (markeId !== undefined) {
                await transactionalMgr.delete(Marke, markeId);
            }
            // "Nullish Coalescing" ab ES2020
            const laptopBilden = laptop.laptopBilden ?? [];
            for (const laptopBild of laptopBilden) {
                await transactionalMgr.delete(LaptopBild, laptopBild.id);
            }

            deleteResult = await transactionalMgr.delete(Laptop, id);
            this.#logger.debug('delete: deleteResult=%o', deleteResult);
        });

        return (
            deleteResult?.affected !== undefined &&
            deleteResult.affected !== null &&
            deleteResult.affected > 0
        );
    }

    async #validateCreate({ modellnummer }: Laptop): Promise<undefined> {
        this.#logger.debug('#validateCreate: modellnummer=%s', modellnummer);
        if (await this.#repo.existsBy({ modellnummer })) {
            throw new ModellnrExistsException(modellnummer);
        }
    }

    async #sendmail(laptop: Laptop) {
        const subject = `Neues Laptop ${laptop.id}`;
        const marke = laptop.marke?.marke ?? 'N/A';
        const body = `Der Laptop mit dem Marke <strong>${marke}</strong> ist angelegt`;
        await this.#mailService.sendmail({ subject, body });
    }

    async #validateUpdate(
        laptop: Laptop,
        id: number,
        versionStr: string,
    ): Promise<Laptop> {
        this.#logger.debug(
            '#validateUpdate: laptop=%o, id=%s, versionStr=%s',
            laptop,
            id,
            versionStr,
        );
        if (!LaptopWriteService.VERSION_PATTERN.test(versionStr)) {
            throw new VersionInvalidException(versionStr);
        }

        const version = Number.parseInt(versionStr.slice(1, -1), 10);
        this.#logger.debug(
            '#validateUpdate: laptop=%o, version=%d',
            laptop,
            version,
        );

        const laptopDb = await this.#readService.findById({ id });

        // nullish coalescing
        const versionDb = laptopDb.version!;
        if (version < versionDb) {
            this.#logger.debug('#validateUpdate: versionDb=%d', version);
            throw new VersionOutdatedException(version);
        }
        this.#logger.debug('#validateUpdate: laptopDb=%o', laptopDb);
        return laptopDb;
    }
}

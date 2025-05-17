// Copyright (C) 2021 - present Juergen Zimmermann, Hochschule Karlsruhe
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
 * Das Modul besteht aus der Controller-Klasse für Lesen an der REST-Schnittstelle.
 * @packageDocumentation
 */

// eslint-disable-next-line max-classes-per-file
import {
    Controller,
    Get,
    Headers,
    HttpStatus,
    NotFoundException,
    Param,
    ParseIntPipe,
    Query,
    Req,
    Res,
    StreamableFile,
    UseInterceptors,
} from '@nestjs/common';
import {
    ApiHeader,
    ApiNotFoundResponse,
    ApiOkResponse,
    ApiOperation,
    ApiParam,
    ApiProperty,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { Public } from 'nest-keycloak-connect';
import { Readable } from 'node:stream';
import { ResponseTimeInterceptor } from '../../logger/response-time.interceptor.js';
import { type Laptop, type LaptopArt } from '../entity/laptop.entity.js';
import { LaptopReadService } from '../service/laptop-read.service.js';
import { type Suchkriterien } from '../service/suchkriterien.js';
import { createPage } from './page.js';
import { createPageable } from '../service/pageable.js';
import { getLogger } from '../../logger/logger.js';
import { paths } from '../../config/paths.js';

/**
 * Klasse für `LaptopGetController`, um Queries in _OpenAPI_ bzw. Swagger zu
 * formulieren. `LaptopController` hat dieselben Properties wie die Basisklasse
 * `Laptop` - allerdings mit dem Unterschied, dass diese Properties beim Ableiten
 * so überschrieben sind, dass sie auch nicht gesetzt bzw. undefined sein
 * dürfen, damit die Queries flexibel formuliert werden können. Deshalb ist auch
 * immer der zusätzliche Typ undefined erforderlich.
 * Außerdem muss noch `string` statt `Date` verwendet werden, weil es in OpenAPI
 * den Typ Date nicht gibt.
 */
export class LaptopQuery implements Suchkriterien {
    @ApiProperty({ required: false })
    declare readonly modellnummer?: string;

    @ApiProperty({ required: false })
    declare readonly art?: LaptopArt;

    @ApiProperty({ required: false })
    declare readonly preis?: number;

    @ApiProperty({ required: false })
    declare readonly rabatt?: number;

    @ApiProperty({ required: false })
    declare readonly lieferbar?: boolean;

    @ApiProperty({ required: false })
    declare readonly datum?: string;

    @ApiProperty({ required: false })
    declare readonly homepage?: string;

    @ApiProperty({ required: false })
    declare readonly touchscreen?: string;

    @ApiProperty({ required: false })
    declare readonly backlit?: string;

    @ApiProperty({ required: false })
    declare readonly marke?: string;

    @ApiProperty({ required: false })
    declare size?: string;

    @ApiProperty({ required: false })
    declare page?: string;
}

/**
 * Die Controller-Klasse für die Verwaltung von Laptops.
 */
// Decorator in TypeScript, zur Standardisierung in ES vorgeschlagen (stage 3)
// https://devblogs.microsoft.com/typescript/announcing-typescript-5-0-beta/#decorators
// https://github.com/tc39/proposal-decorators
@Controller(paths.rest)
@UseInterceptors(ResponseTimeInterceptor)
@ApiTags('Laptop REST-API')
// @ApiBearerAuth()
// Klassen ab ES 2015
export class LaptopGetController {
    // readonly in TypeScript, vgl. C#
    // private ab ES 2019
    readonly #service: LaptopReadService;

    readonly #logger = getLogger(LaptopGetController.name);

    // Dependency Injection (DI) bzw. Constructor Injection
    // constructor(private readonly service: LaptopReadService) {}
    // https://github.com/tc39/proposal-type-annotations#omitted-typescript-specific-features-that-generate-code
    constructor(service: LaptopReadService) {
        this.#service = service;
    }

    /**
     * Ein Laptop wird asynchron anhand seiner ID als Pfadparameter gesucht.
     *
     * Falls es ein solches Laptop gibt und `If-None-Match` im Request-Header
     * auf die aktuelle Version des Laptops gesetzt war, wird der Statuscode
     * `304` (`Not Modified`) zurückgeliefert. Falls `If-None-Match` nicht
     * gesetzt ist oder eine veraltete Version enthält, wird das gefundene
     * Laptop im Rumpf des Response als JSON-Datensatz mit Atom-Links für HATEOAS
     * und dem Statuscode `200` (`OK`) zurückgeliefert.
     *
     * Falls es kein Laptop zur angegebenen ID gibt, wird der Statuscode `404`
     * (`Not Found`) zurückgeliefert.
     *
     * @param id Pfad-Parameter `id`
     * @param req Request-Objekt von Express mit Pfadparameter, Query-String,
     *            Request-Header und Request-Body.
     * @param version Versionsnummer im Request-Header bei `If-None-Match`
     * @param res Leeres Response-Objekt von Express.
     * @returns Leeres Promise-Objekt.
     */
    // eslint-disable-next-line max-params
    @Get(':id')
    @Public()
    @ApiOperation({ summary: 'Suche mit der Laptop-ID' })
    @ApiParam({
        name: 'id',
        description: 'Z.B. 1',
    })
    @ApiHeader({
        name: 'If-None-Match',
        description: 'Header für bedingte GET-Requests, z.B. "0"',
        required: false,
    })
    @ApiOkResponse({ description: 'Das Laptop wurde gefunden' })
    @ApiNotFoundResponse({ description: 'Kein Laptop zur ID gefunden' })
    @ApiResponse({
        status: HttpStatus.NOT_MODIFIED,
        description: 'Das Laptop wurde bereits heruntergeladen',
    })
    async getById(
        @Param(
            'id',
            new ParseIntPipe({ errorHttpStatusCode: HttpStatus.NOT_FOUND }),
        )
        id: number,
        @Req() req: Request,
        @Headers('If-None-Match') version: string | undefined,
        @Res() res: Response,
    ): Promise<Response<Laptop | undefined>>{
        this.#logger.debug('getById: id=%s, version=%s', id, version);

        if (req.accepts(['json', 'html']) === false) {
            this.#logger.debug('getById: accepted=%o', req.accepted);
            return res.sendStatus(HttpStatus.NOT_ACCEPTABLE);
        }

        const laptop = await this.#service.findById({ id });
        if (this.#logger.isLevelEnabled('debug')) {
            this.#logger.debug('getById(): laptop=%s', laptop.toString());
            this.#logger.debug('getById(): marke=%o', laptop.marke);
        }

        // ETags
        const versionDb = laptop.version;
        if (version === `"${versionDb}"`) {
            this.#logger.debug('getById: NOT_MODIFIED');
            return res.sendStatus(HttpStatus.NOT_MODIFIED);
        }
        this.#logger.debug('getById: versionDb=%s', versionDb);
        res.header('ETag', `"${versionDb}"`);

        this.#logger.debug('getById: laptop=%o', laptop);
        return res.json(laptop);
    }

    /**
     * Bücher werden mit Query-Parametern asynchron gesucht. Falls es mindestens
     * ein solches Laptop gibt, wird der Statuscode `200` (`OK`) gesetzt. Im Rumpf
     * des Response ist das JSON-Array mit den gefundenen Büchern, die jeweils
     * um Atom-Links für HATEOAS ergänzt sind.
     *
     * Falls es kein Laptop zu den Suchkriterien gibt, wird der Statuscode `404`
     * (`Not Found`) gesetzt.
     *
     * Falls es keine Query-Parameter gibt, werden alle Bücher ermittelt.
     *
     * @param query Query-Parameter von Express.
     * @param req Request-Objekt von Express.
     * @param res Leeres Response-Objekt von Express.
     * @returns Leeres Promise-Objekt.
     */
    @Get()
    @Public()
    @ApiOperation({ summary: 'Suche mit Suchkriterien' })
    @ApiOkResponse({ description: 'Eine evtl. leere Liste mit Büchern' })
    async get(
        @Query() query: LaptopQuery,
        @Req() req: Request,
        @Res() res: Response,
    ): Promise<Response<Laptop[] | undefined>> {
        this.#logger.debug('get: query=%o', query);

        if (req.accepts(['json', 'html']) === false) {
            this.#logger.debug('get: accepted=%o', req.accepted);
            return res.sendStatus(HttpStatus.NOT_ACCEPTABLE);
        }

        const { page, size } = query;
        delete query['page'];
        delete query['size'];
        this.#logger.debug('get: page=%s, size=%s', page, size);

        const keys = Object.keys(query) as (keyof LaptopQuery)[];
        keys.forEach((key) => {
            if (query[key] === undefined) {
                delete query[key];
            }
        });
        this.#logger.debug('get: query=%o', query);

        const pageable = createPageable({ number: page, size });
        const laptopsSlice = await this.#service.find(query, pageable);
        const laptopPage = createPage(laptopsSlice, pageable);
        this.#logger.debug('get: laptopPage=%o', laptopPage);

        return res.json(laptopPage).send();
    }

    @Get('/file/:id')
    @Public()
    @ApiOperation({ description: 'Suche nach Datei mit der Laptop-ID' })
    @ApiParam({
        name: 'id',
        description: 'Z.B. 1',
    })
    @ApiNotFoundResponse({ description: 'Keine Datei zur Laptop-ID gefunden' })
    @ApiOkResponse({ description: 'Die Datei wurde gefunden' })
    async getFileById(
        @Param('id') idStr: number,
        @Res({ passthrough: true }) res: Response,
    ) {
        this.#logger.debug('getFileById: laptopId:%s', idStr);

        const id = Number(idStr);
        if (!Number.isInteger(id)) {
            this.#logger.debug('getById: not isInteger()');
            throw new NotFoundException(`Die Laptop-ID ${idStr} ist ungueltig.`);
        }

        const laptopFile = await this.#service.findFileByLaptopId(id);
        if (laptopFile?.data === undefined) {
            throw new NotFoundException('Keine Datei gefunden.');
        }

        const stream = Readable.from(laptopFile.data);
        res.contentType(laptopFile.mimetype ?? 'image/png').set({
            'Content-Disposition': `inline; filename="${laptopFile.filename}"`, // eslint-disable-line @typescript-eslint/naming-convention
        });

        return new StreamableFile(stream);
    }
}

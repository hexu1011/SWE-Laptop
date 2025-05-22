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

// eslint-disable-next-line max-classes-per-file
import { UseFilters, UseGuards, UseInterceptors } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { IsInt, IsNumberString, Min } from 'class-validator';
import Decimal from 'decimal.js'; // eslint-disable-line @typescript-eslint/naming-convention
import { AuthGuard, Roles } from 'nest-keycloak-connect';
import { getLogger } from '../../logger/logger.js';
import { ResponseTimeInterceptor } from '../../logger/response-time.interceptor.js';
import { LaptopDTO } from '../controller/laptopDTO.entity.js';
import { type LaptopBild } from '../entity/laptopBild.entity.js';
import { type Laptop } from '../entity/laptop.entity.js';
import { type Marke } from '../entity/marke.entity.js';
import { LaptopWriteService } from '../service/laptop-write.service.js';
import { type IdInput } from './laptop-query.resolver.js';
import { HttpExceptionFilter } from './http-exception.filter.js';

// Authentifizierung und Autorisierung durch
//  GraphQL Shield
//      https://www.graphql-shield.com
//      https://github.com/maticzav/graphql-shield
//      https://github.com/nestjs/graphql/issues/92
//      https://github.com/maticzav/graphql-shield/issues/213
//  GraphQL AuthZ
//      https://github.com/AstrumU/graphql-authz
//      https://www.the-guild.dev/blog/graphql-authz

export type CreatePayload = {
    readonly id: number;
};

export type UpdatePayload = {
    readonly version: number;
};

export class LaptopUpdateDTO extends LaptopDTO {
    @IsNumberString()
    readonly id!: string;

    @IsInt()
    @Min(0)
    readonly version!: number;
}
@Resolver('Laptop')
// alternativ: globale Aktivierung der Guards https://docs.nestjs.com/security/authorization#basic-rbac-implementation
@UseGuards(AuthGuard)
@UseFilters(HttpExceptionFilter)
@UseInterceptors(ResponseTimeInterceptor)
export class LaptopMutationResolver {
    readonly #service: LaptopWriteService;

    readonly #logger = getLogger(LaptopMutationResolver.name);

    constructor(service: LaptopWriteService) {
        this.#service = service;
    }

    @Mutation()
    @Roles('admin', 'user')
    async create(@Args('input') laptopDTO: LaptopDTO) {
        this.#logger.debug('create: laptopDTO=%o', laptopDTO);

        const laptop = this.#laptopDtoToLaptop(laptopDTO);
        const id = await this.#service.create(laptop);
        this.#logger.debug('createLaptop: id=%d', id);
        const payload: CreatePayload = { id };
        return payload;
    }

    @Mutation()
    @Roles('admin', 'user')
    async update(@Args('input') laptopDTO: LaptopUpdateDTO) {
        this.#logger.debug('update: laptop=%o', laptopDTO);

        const laptop = this.#laptopUpdateDtoToLaptop(laptopDTO);
        const versionStr = `"${laptopDTO.version.toString()}"`;

        const versionResult = await this.#service.update({
            id: Number.parseInt(laptopDTO.id, 10),
            laptop,
            version: versionStr,
        });
        // TODO BadUserInputError
        this.#logger.debug('updateLaptop: versionResult=%d', versionResult);
        const payload: UpdatePayload = { version: versionResult };
        return payload;
    }

    @Mutation()
    @Roles('admin')
    async delete(@Args() id: IdInput) {
        const idStr = id.id;
        this.#logger.debug('delete: id=%s', idStr);
        const deletePerformed = await this.#service.delete(idStr);
        this.#logger.debug('deleteLaptop: deletePerformed=%s', deletePerformed);
        return deletePerformed;
    }

    #laptopDtoToLaptop(laptopDTO: LaptopDTO): Laptop {
        const markeDTO = laptopDTO.marke;
        const marke: Marke = {
            id: undefined,
            marke: markeDTO.marke,
            reihe: markeDTO.reihe,
            laptop: undefined,
        };
        // "Optional Chaining" ab ES2020
        const laptopBilden = laptopDTO.laptopBilden?.map((laptopBildDTO) => {
            const laptopBild: LaptopBild = {
                id: undefined,
                beschriftung: laptopBildDTO.beschriftung,
                contentType: laptopBildDTO.contentType,
                laptop: undefined,
            };
            return laptopBild;
        });
        const laptop: Laptop = {
            id: undefined,
            version: undefined,
            modellnummer: laptopDTO.modellnummer,
            art: laptopDTO.art,
            preis: Decimal(laptopDTO.preis),
            rabatt: Decimal(laptopDTO.rabatt ?? ''),
            lieferbar: laptopDTO.lieferbar,
            datum: laptopDTO.datum,
            homepage: laptopDTO.homepage,
            merkmale: laptopDTO.merkmale,
            marke,
            laptopBilden,
            datei: undefined,
            erzeugt: new Date(),
            aktualisiert: new Date(),
        };

        // Rueckwaertsverweis
        laptop.marke!.laptop = laptop;
        return laptop;
    }

    #laptopUpdateDtoToLaptop(laptopDTO: LaptopUpdateDTO): Laptop {
        return {
            id: undefined,
            version: undefined,
            modellnummer: laptopDTO.modellnummer,
            art: laptopDTO.art,
            preis: Decimal(laptopDTO.preis),
            rabatt: Decimal(laptopDTO.rabatt ?? ''),
            lieferbar: laptopDTO.lieferbar,
            datum: laptopDTO.datum,
            homepage: laptopDTO.homepage,
            merkmale: laptopDTO.merkmale,
            marke: undefined,
            laptopBilden: undefined,
            datei: undefined,
            erzeugt: undefined,
            aktualisiert: new Date(),
        };
    }

    // #errorMsgCreateLaptop(err: CreateError) {
    //     switch (err.type) {
    //         case 'ModellnummerExists': {
    //             return `Die Modellnummer ${err.modellnummer} existiert bereits`;
    //         }
    //         default: {
    //             return 'Unbekannter Fehler';
    //         }
    //     }
    // }

    // #errorMsgUpdateLaptop(err: UpdateError) {
    //     switch (err.type) {
    //         case 'LaptopNotExists': {
    //             return `Es gibt kein Laptop mit der ID ${err.id}`;
    //         }
    //         case 'VersionInvalid': {
    //             return `"${err.version}" ist keine gueltige Versionsnummer`;
    //         }
    //         case 'VersionOutdated': {
    //             return `Die Versionsnummer "${err.version}" ist nicht mehr aktuell`;
    //         }
    //         default: {
    //             return 'Unbekannter Fehler';
    //         }
    //     }
    // }
}

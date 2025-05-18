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

import { beforeAll, describe, expect, inject, test } from 'vitest';
import { HttpStatus } from '@nestjs/common';
import axios, { type AxiosInstance, type AxiosResponse } from 'axios';
import { Decimal } from 'decimal.js';
import { type LaptopDTO } from '../../src/laptop/controller/laptopDTO.entity.js';
import { LaptopReadService } from '../../src/laptop/service/laptop-read.service.js';
import { baseURL, httpsAgent } from '../constants.mjs';
import { type ErrorResponse } from './error-response.mjs';

const token = inject('tokenRest');

// -----------------------------------------------------------------------------
// T e s t d a t e n
// -----------------------------------------------------------------------------
const neuesLaptop: Omit<LaptopDTO, 'preis' | 'rabatt'> & {
    preis: number;
    rabatt: number;
} = {
    modellnummer: '978-0-007-00644-1',
    art: 'GAMING',
    preis: 99.99,
    rabatt: 0.0123,
    lieferbar: true,
    datum: '2022-02-28',
    homepage: 'https://post.rest',
    merkmale: ['TOUCHSCREEN', 'BATTERY'],
    marke: {
        marke: 'Markepost',
        reihe: 'reihepos',
    },
    laptopBilden: [
        {
            beschriftung: 'Abb. 1',
            contentType: 'img/png',
        },
    ],
};
const neuesLaptopInvalid: Record<string, unknown> = {
    modellnummer: 'falsche-ISBN',
    art: 'marke',
    preis: -1,
    rabatt: 2,
    lieferbar: true,
    datum: '12345-123-123',
    homepage: 'anyHomepage',
    marke: {
        marke: '?!',
        reihe: 'Reiheinvalid',
    },
};
const neuesLaptopIsbnExistiert: LaptopDTO = {
    modellnummer: '978-3-897-22583-1',
    art: 'GAMING',
    preis: new Decimal(99.99),
    rabatt: new Decimal(0.09),
    lieferbar: true,
    datum: '2022-02-28',
    homepage: 'https://post.isbn/',
    merkmale: ['TOUCHSCREEN', 'BATTERY'],
    marke: {
        marke: 'Markepostisbn',
        reihe: 'Reihepostisbn',
    },
    laptopBilden: [],
};

// -----------------------------------------------------------------------------
// T e s t s
// -----------------------------------------------------------------------------
// Test-Suite
describe('POST /rest', () => {
    let client: AxiosInstance;
    const restURL = `${baseURL}/rest`;
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    // Axios initialisieren
    beforeAll(async () => {
        client = axios.create({
            baseURL: restURL,
            httpsAgent,
            validateStatus: (status) => status < 500,
        });
    });

    test('Neues Laptop', async () => {
        // given
        headers.Authorization = `Bearer ${token}`;

        // when
        const response: AxiosResponse<string> = await client.post(
            '',
            neuesLaptop,
            { headers },
        );

        // then
        const { status, data } = response;

        expect(status).toBe(HttpStatus.CREATED);

        const { location } = response.headers as { location: string };

        expect(location).toBeDefined();

        // ID nach dem letzten "/"
        const indexLastSlash: number = location.lastIndexOf('/');

        expect(indexLastSlash).not.toBe(-1);

        const idStr = location.slice(indexLastSlash + 1);

        expect(idStr).toBeDefined();
        expect(LaptopReadService.ID_PATTERN.test(idStr)).toBe(true);

        expect(data).toBe('');
    });

    test.concurrent('Neues Laptop mit ungueltigen Daten', async () => {
        // given
        headers.Authorization = `Bearer ${token}`;
        const expectedMsg = [
            expect.stringMatching(/^modellnummer /u),
            expect.stringMatching(/^art /u),
            expect.stringMatching(/^preis /u),
            expect.stringMatching(/^rabatt /u),
            expect.stringMatching(/^datum /u),
            expect.stringMatching(/^homepage /u),
            expect.stringMatching(/^marke.marke /u),
        ];

        // when
        const response: AxiosResponse<Record<string, any>> = await client.post(
            '',
            neuesLaptopInvalid,
            { headers },
        );

        // then
        const { status, data } = response;

        expect(status).toBe(HttpStatus.BAD_REQUEST);

        const messages = data.message as string[];

        expect(messages).toBeDefined();
        expect(messages).toHaveLength(expectedMsg.length);
        expect(messages).toStrictEqual(expect.arrayContaining(expectedMsg));
    });

    test.concurrent(
        'Neues Laptop, aber die Modellnummer existiert bereits',
        async () => {
            // given
            headers.Authorization = `Bearer ${token}`;

            // when
            const response: AxiosResponse<ErrorResponse> = await client.post(
                '',
                neuesLaptopIsbnExistiert,
                { headers },
            );

            // then
            const { data } = response;

            const { message, statusCode } = data;

            expect(message).toStrictEqual(expect.stringContaining('MODELLNr'));
            expect(statusCode).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
        });

    test.concurrent('Neues Laptop, aber ohne Token', async () => {
        // when
        const response: AxiosResponse<Record<string, any>> = await client.post(
            '',
            neuesLaptop,
        );

        // then
        expect(response.status).toBe(HttpStatus.UNAUTHORIZED);
    });

    test.concurrent('Neues Laptop, aber mit falschem Token', async () => {
        // given
        const token = 'FALSCH';
        headers.Authorization = `Bearer ${token}`;

        // when
        const response: AxiosResponse<Record<string, any>> = await client.post(
            '',
            neuesLaptop,
            { headers },
        );

        // then
        expect(response.status).toBe(HttpStatus.UNAUTHORIZED);
    });

    test.concurrent.todo('Abgelaufener Token');
});

// Copyright (C) 2025 - present Juergen Zimmermann, Hochschule Karlsruhe
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

import { beforeAll, describe, expect, test } from 'vitest';
import { HttpStatus } from '@nestjs/common';
import axios, { type AxiosInstance, type AxiosResponse } from 'axios';
import { Decimal } from 'decimal.js';
import { type Laptop } from '../../src/laptop/entity/laptop.entity.js';
import { type Page } from '../../src/laptop/controller/page.js';
import { baseURL, httpsAgent } from '../constants.mjs';
import { type ErrorResponse } from './error-response.mjs';

// -----------------------------------------------------------------------------
// T e s t d a t e n
// -----------------------------------------------------------------------------
const markeVorhanden = 'a';
const markeNichtVorhanden = 'xx';
const preisMax = 33.5;
const merkmaleVorhanden = 'javascript';
const merkmaleNichtVorhanden = 'csharp';

// -----------------------------------------------------------------------------
// T e s t s
// -----------------------------------------------------------------------------
// Test-Suite
describe('GET /rest', () => {
    let restUrl: string;
    let client: AxiosInstance;

    // Axios initialisieren
    beforeAll(async () => {
        restUrl = `${baseURL}/rest`;
        client = axios.create({
            baseURL: restUrl,
            httpsAgent,
            validateStatus: () => true,
        });
    });

    test.concurrent('Alle Buecher', async () => {
        // given

        // when
        const { status, headers, data }: AxiosResponse<Page<Laptop>> =
            await client.get('/');

        // then
        expect(status).toBe(HttpStatus.OK);
        expect(headers['content-type']).toMatch(/json/iu);
        expect(data).toBeDefined();

        data.content
            .map((laptop) => laptop.id)
            .forEach((id) => {
                expect(id).toBeDefined();
            });
    });

    test.concurrent('Laptops mit einem Teil-Marke suchen', async () => {
        // given
        const params = { marke: markeVorhanden };

        // when
        const { status, headers, data }: AxiosResponse<Page<Laptop>> =
            await client.get('/', { params });

        // then
        expect(status).toBe(HttpStatus.OK);
        expect(headers['content-type']).toMatch(/json/iu);
        expect(data).toBeDefined();

        // Jedes Laptop hat einen Marke mit dem Teilstring 'a'
        data.content
            .map((laptop) => laptop.marke)
            .forEach((marke) =>
                expect(marke?.marke?.toLowerCase()).toStrictEqual(
                    expect.stringContaining(markeVorhanden),
                ),
            );
    });

    test.concurrent(
        'Laptops zu einem nicht vorhandenen Teil-Marke suchen',
        async () => {
            // given
            const params = { marke: markeNichtVorhanden };

            // when
            const { status, data }: AxiosResponse<ErrorResponse> =
                await client.get('/', { params });

            // then
            expect(status).toBe(HttpStatus.NOT_FOUND);

            const { error, statusCode } = data;

            expect(error).toBe('Not Found');
            expect(statusCode).toBe(HttpStatus.NOT_FOUND);
        },
    );

    test.concurrent('Laptops mit max. Preis suchen', async () => {
        // given
        const params = { preis: preisMax };

        // when
        const { status, headers, data }: AxiosResponse<Page<Laptop>> =
            await client.get('/', { params });

        // then
        expect(status).toBe(HttpStatus.OK);
        expect(headers['content-type']).toMatch(/json/iu);
        expect(data).toBeDefined();

        // Jedes Laptop hat einen Marke mit dem Teilstring 'a'
        data.content
            .map((laptop) => Decimal(laptop?.preis ?? 0))
            .forEach((preis) =>
                expect(preis.lessThanOrEqualTo(Decimal(preisMax))).toBe(true),
            );
    });

    test.concurrent('Mind. 1 Laptop mit vorhandenem Merkmale', async () => {
        // given
        const params = { [merkmaleVorhanden]: 'true' };

        // when
        const { status, headers, data }: AxiosResponse<Page<Laptop>> =
            await client.get('/', { params });

        // then
        expect(status).toBe(HttpStatus.OK);
        expect(headers['content-type']).toMatch(/json/iu);
        // JSON-Array mit mind. 1 JSON-Objekt
        expect(data).toBeDefined();

        // Jedes merkmale hat im Array der Merkmale z.B. "javascript"
        data.content
            .map((laptop) => laptop.merkmale)
            .forEach((merkmale) =>
                expect(merkmale).toStrictEqual(
                    expect.arrayContaining([merkmaleVorhanden.toUpperCase()]),
                ),
            );
    });

    test.concurrent(
        'Keine Laptops zu einem nicht vorhandenen merkmale',
        async () => {
            // given
            const params = { [merkmaleNichtVorhanden]: 'true' };

            // when
            const { status, data }: AxiosResponse<ErrorResponse> =
                await client.get('/', { params });

            // then
            expect(status).toBe(HttpStatus.NOT_FOUND);

            const { error, statusCode } = data;

            expect(error).toBe('Not Found');
            expect(statusCode).toBe(HttpStatus.NOT_FOUND);
        },
    );

    test.concurrent(
        'Keine Laptops zu einer nicht-vorhandenen Property',
        async () => {
            // given
            const params = { foo: 'bar' };

            // when
            const { status, data }: AxiosResponse<ErrorResponse> =
                await client.get('/', { params });

            // then
            expect(status).toBe(HttpStatus.NOT_FOUND);

            const { error, statusCode } = data;

            expect(error).toBe('Not Found');
            expect(statusCode).toBe(HttpStatus.NOT_FOUND);
        },
    );
});

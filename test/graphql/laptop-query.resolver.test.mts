/* eslint-disable @typescript-eslint/no-non-null-assertion */
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

import { type GraphQLRequest } from '@apollo/server';
import { beforeAll, describe, expect, test } from 'vitest';
import { HttpStatus } from '@nestjs/common';
import axios, { type AxiosInstance, type AxiosResponse } from 'axios';
import {
    type Laptop,
    type LaptopArt,
} from '../../src/laptop/entity/laptop.entity.js';
import { type GraphQLResponseBody } from './graphql.mjs';
import { baseURL, httpsAgent } from '../constants.mjs';

type LaptopDTO = Omit<
    Laptop,
    'laptopBilden' | 'aktualisiert' | 'erzeugt' | 'rabatt'
> & {
    rabatt: string;
};

// -----------------------------------------------------------------------------
// T e s t d a t e n
// -----------------------------------------------------------------------------
const idVorhanden = '1';

const markeVorhanden = 'Alpha';
const teilMarkeVorhanden = 'a';
const teilMarkeNichtVorhanden = 'abc';

const modellnummerVorhanden = 'XPS15-9320';

// -----------------------------------------------------------------------------
// T e s t s
// -----------------------------------------------------------------------------
// Test-Suite
describe('GraphQL Queries', () => {
    let client: AxiosInstance;
    const graphqlPath = 'graphql';

    // Axios initialisieren
    beforeAll(async () => {
        const baseUrlGraphQL = `${baseURL}/`;
        client = axios.create({
            baseURL: baseUrlGraphQL,
            httpsAgent,
            // auch Statuscode 400 als gueltigen Request akzeptieren, wenn z.B.
            // ein Enum mit einem falschen String getestest wird
            validateStatus: () => true,
        });
    });

    test.concurrent('Laptop zu vorhandener ID', async () => {
        // given
        const body: GraphQLRequest = {
            query: `
                {
                    laptop(id: "${idVorhanden}") {
                        version
                        modellnummer
                        art
                        preis
                        lieferbar
                        datum
                        homepage
                        merkmale
                        marke {
                            marke
                        }
                        rabatt(short: true)
                    }
                }
            `,
        };

        // when
        const { status, headers, data }: AxiosResponse<GraphQLResponseBody> =
            await client.post(graphqlPath, body);

        // then
        expect(status).toBe(HttpStatus.OK);
        expect(headers['content-type']).toMatch(/json/iu);
        expect(data.errors).toBeUndefined();
        expect(data.data).toBeDefined();

        const { laptop } = data.data! as { laptop: LaptopDTO };

        expect(laptop.marke?.marke).toMatch(/^\w/u);
        expect(laptop.version).toBeGreaterThan(-1);
        expect(laptop.id).toBeUndefined();
    });

    test.concurrent('Laptop zu nicht-vorhandener ID', async () => {
        // given
        const id = '999999';
        const body: GraphQLRequest = {
            query: `
                {
                    laptop(id: "${id}") {
                        marke {
                            marke
                        }
                    }
                }
            `,
        };

        // when
        const { status, headers, data }: AxiosResponse<GraphQLResponseBody> =
            await client.post(graphqlPath, body);

        // then
        expect(status).toBe(HttpStatus.OK);
        expect(headers['content-type']).toMatch(/json/iu);
        expect(data.data!.laptop).toBeNull();

        const { errors } = data;

        expect(errors).toHaveLength(1);

        const [error] = errors!;
        const { message, path, extensions } = error;

        expect(message).toBe(`Es gibt kein Laptop mit der ID ${id}.`);
        expect(path).toBeDefined();
        expect(path![0]).toBe('laptop');
        expect(extensions).toBeDefined();
        expect(extensions!.code).toBe('BAD_USER_INPUT');
    });

    test.concurrent('Laptop zu vorhandenem Marke', async () => {
        // given
        const body: GraphQLRequest = {
            query: `
                {
                    laptops(suchkriterien: {
                        marke: "${markeVorhanden}"
                    }) {
                        art
                        marke {
                            marke
                        }
                    }
                }
            `,
        };

        // when
        const { status, headers, data }: AxiosResponse<GraphQLResponseBody> =
            await client.post(graphqlPath, body);

        // then
        expect(status).toBe(HttpStatus.OK);
        expect(headers['content-type']).toMatch(/json/iu);
        expect(data.errors).toBeUndefined();
        expect(data.data).toBeDefined();

        const { laptops } = data.data! as { laptops: LaptopDTO[] };

        expect(laptops).not.toHaveLength(0);
        expect(laptops).toHaveLength(1);

        const [laptop] = laptops;

        expect(laptop!.marke?.marke).toBe(markeVorhanden);
    });

    test.concurrent('Laptop zu vorhandenem Teil-Marke', async () => {
        // given
        const body: GraphQLRequest = {
            query: `
                {
                    laptops(suchkriterien: {
                        marke: "${teilMarkeVorhanden}"
                    }) {
                        marke {
                            marke
                        }
                    }
                }
            `,
        };

        // when
        const { status, headers, data }: AxiosResponse<GraphQLResponseBody> =
            await client.post(graphqlPath, body);

        // then
        expect(status).toBe(HttpStatus.OK);
        expect(headers['content-type']).toMatch(/json/iu);
        expect(data.errors).toBeUndefined();
        expect(data.data).toBeDefined();

        const { laptops } = data.data! as { laptops: LaptopDTO[] };

        expect(laptops).not.toHaveLength(0);

        laptops
            .map((laptop) => laptop.marke)
            .forEach((marke) =>
                expect(marke?.marke?.toLowerCase()).toStrictEqual(
                    expect.stringContaining(teilMarkeVorhanden),
                ),
            );
    });

    test.concurrent('Laptop zu nicht vorhandenem Marke', async () => {
        // given
        const body: GraphQLRequest = {
            query: `
                {
                    laptops(suchkriterien: {
                        marke: "${teilMarkeNichtVorhanden}"
                    }) {
                        art
                        marke {
                            marke
                        }
                    }
                }
            `,
        };

        // when
        const { status, headers, data }: AxiosResponse<GraphQLResponseBody> =
            await client.post(graphqlPath, body);

        // then
        expect(status).toBe(HttpStatus.OK);
        expect(headers['content-type']).toMatch(/json/iu);
        expect(data.data!.buecher).toBeNull();

        const { errors } = data;

        expect(errors).toHaveLength(1);

        const [error] = errors!;
        const { message, path, extensions } = error;

        expect(message).toMatch(/^Keine Buecher gefunden:/u);
        expect(path).toBeDefined();
        expect(path![0]).toBe('buecher');
        expect(extensions).toBeDefined();
        expect(extensions!.code).toBe('BAD_USER_INPUT');
    });

    test.concurrent('Laptop zu vorhandener Modellnummer', async () => {
        // given
        const body: GraphQLRequest = {
            query: `
                {
                    laptops(suchkriterien: {
                        modellnummer: "${modellnummerVorhanden}"
                    }) {
                        modellnummer
                        marke {
                            marke
                        }
                    }
                }
            `,
        };

        // when
        const { status, headers, data }: AxiosResponse<GraphQLResponseBody> =
            await client.post(graphqlPath, body);

        // then
        expect(status).toBe(HttpStatus.OK);
        expect(headers['content-type']).toMatch(/json/iu);
        expect(data.errors).toBeUndefined();
        expect(data.data).toBeDefined();

        const { laptops } = data.data! as { laptops: LaptopDTO[] };

        expect(laptops).not.toHaveLength(0);
        expect(laptops).toHaveLength(1);

        const [laptop] = laptops;
        const { modellnummer, marke } = laptop!;

        expect(modellnummer).toBe(modellnummerVorhanden);
        expect(marke?.marke).toBeDefined();
    });

    test.concurrent('Laptops zur Art "GAMING"', async () => {
        // given
        const laptopArt: LaptopArt = 'GAMING';
        const body: GraphQLRequest = {
            query: `
                {
                    laptops(suchkriterien: {
                        art: ${laptopArt}
                    }) {
                        art
                        marke {
                            marke
                        }
                    }
                }
            `,
        };

        // when
        const { status, headers, data }: AxiosResponse<GraphQLResponseBody> =
            await client.post(graphqlPath, body);

        // then
        expect(status).toBe(HttpStatus.OK);
        expect(headers['content-type']).toMatch(/json/iu);
        expect(data.errors).toBeUndefined();
        expect(data.data).toBeDefined();

        const { laptops } = data.data! as { laptops: LaptopDTO[] };

        expect(laptops).not.toHaveLength(0);

        laptops.forEach((laptop) => {
            const { art, marke } = laptop;

            expect(art).toBe(laptopArt);
            expect(marke?.marke).toBeDefined();
        });
    });

    test.concurrent('Laptops zur einer ungueltigen Art', async () => {
        // given
        const laptopArt = 'UNGUELTIG';
        const body: GraphQLRequest = {
            query: `
                {
                    laptops(suchkriterien: {
                        art: ${laptopArt}
                    }) {
                        marke {
                            marke
                        }
                    }
                }
            `,
        };

        // when
        const { status, headers, data }: AxiosResponse<GraphQLResponseBody> =
            await client.post(graphqlPath, body);

        // then
        expect(status).toBe(HttpStatus.BAD_REQUEST);
        expect(headers['content-type']).toMatch(/json/iu);
        expect(data.data).toBeUndefined();

        const { errors } = data;

        expect(errors).toHaveLength(1);

        const [error] = errors!;
        const { extensions } = error;

        expect(extensions).toBeDefined();
        expect(extensions!.code).toBe('GRAPHQL_VALIDATION_FAILED');
    });

    test.concurrent('laptops mit lieferbar=true', async () => {
        // given
        const body: GraphQLRequest = {
            query: `
                {
                    laptops(suchkriterien: {
                        lieferbar: true
                    }) {
                        lieferbar
                        marke {
                            marke
                        }
                    }
                }
            `,
        };

        // when
        const { status, headers, data }: AxiosResponse<GraphQLResponseBody> =
            await client.post(graphqlPath, body);

        // then
        expect(status).toBe(HttpStatus.OK);
        expect(headers['content-type']).toMatch(/json/iu);
        expect(data.errors).toBeUndefined();
        expect(data.data).toBeDefined();

        const { laptops } = data.data! as { laptops: LaptopDTO[] };

        expect(laptops).not.toHaveLength(0);

        laptops.forEach((laptop) => {
            const { lieferbar, marke } = laptop;

            expect(lieferbar).toBe(true);
            expect(marke?.marke).toBeDefined();
        });
    });
});

/* eslint-enable @typescript-eslint/no-non-null-assertion */

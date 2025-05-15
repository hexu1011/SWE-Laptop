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

// Nest unterstützt verschiedene Werkzeuge fuer OR-Mapping
// https://docs.nestjs.com/techniques/database
//  * TypeORM     https://typeorm.io
//  * Sequelize   https://sequelize.org
//  * Knex        https://knexjs.org

// TypeORM unterstützt die Patterns
//  * "Data Mapper" und orientiert sich an Hibernate (Java), Doctrine (PHP) und Entity Framework (C#)
//  * "Active Record" und orientiert sich an Mongoose (JavaScript)

// TypeORM unterstützt u.a. die DB-Systeme
//  * Postgres
//  * MySQL
//  * SQLite durch sqlite3 und better-sqlite3
//  * Oracle
//  * Microsoft SQL Server
//  * SAP Hana
//  * Cloud Spanner von Google

/**
 * Das Modul besteht aus der Entity-Klasse.
 * @packageDocumentation
 */

import { ApiProperty } from '@nestjs/swagger';
import Decimal from 'decimal.js'; // eslint-disable-line @typescript-eslint/naming-convention
import {
    Column,
    CreateDateColumn,
    Entity,
    OneToMany,
    OneToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
    VersionColumn,
} from 'typeorm';
import { dbType } from '../../config/db.js';
import { LaptopBild } from './laptopBild.entity.js';
import { LaptopDatei } from './laptopDatei.entity.js';
import { DecimalTransformer } from './decimal-transformer.js';
import { Marke } from './marke.entity.js';

/**
 * Alias-Typ für gültige Strings bei der Art eines Laptops.
 */
export type LaptopArt = 'ULTRABOOK' | 'GAMING' | 'BUSINESS';

/**
 * Entity-Klasse zu einer relationalen Tabelle.
 * BEACHTE: Jede Entity-Klasse muss in einem JSON-Array deklariert sein, das in
 * TypeOrmModule.forFeature(...) verwendet wird.
 * Im Beispiel ist das JSON-Array in src\laptop\entity\entities.ts und
 * TypeOrmModule.forFeature(...) wird in src\laptop\laptop.module.ts aufgerufen.
 */
// https://typeorm.io/entities
@Entity()
export class Laptop {
    // https://typeorm.io/entities#primary-columns
    // default: strategy = 'increment' (SEQUENCE, GENERATED ALWAYS AS IDENTITY, AUTO_INCREMENT)
    @PrimaryGeneratedColumn()
    id: number | undefined;

    @VersionColumn()
    readonly version: number | undefined;

    @Column('varchar')
    @ApiProperty({ example: 'XPS15-9320', type: String })
    readonly modellnummer: string | undefined;

    @Column('varchar')
    @ApiProperty({ example: 'GAMING', type: String })
    readonly art: LaptopArt | undefined;

    // TypeORM liest Gleitkommazahlen als String: Rundungsfehler vermeiden
    @Column('decimal', {
        precision: 8,
        scale: 2,
        // https://typeorm.io/entities#column-options
        transformer: new DecimalTransformer(),
    })
    @ApiProperty({ example: 1, type: Number })
    // Decimal aus decimal.js analog zu BigDecimal von Java
    readonly preis: Decimal | undefined;

    @Column('decimal', {
        precision: 4,
        scale: 3,
        transformer: new DecimalTransformer(),
    })
    @ApiProperty({ example: 0.1, type: Number })
    readonly rabatt: Decimal | undefined;

    @Column('decimal') // TypeORM unterstuetzt bei Oracle *NICHT* den Typ boolean
    @ApiProperty({ example: true, type: Boolean })
    readonly lieferbar: boolean | undefined;

    @Column('date')
    @ApiProperty({ example: '2021-01-31' })
    // TypeORM unterstuetzt *NICHT* das Temporal-API (ES2022)
    readonly datum: Date | string | undefined;

    @Column('varchar')
    @ApiProperty({ example: 'https://test.de/', type: String })
    readonly homepage: string | undefined;

    // https://typeorm.io/entities#simple-array-column-type
    // nicht "readonly": null ersetzen durch []
    @Column('simple-array')
    merkmale: string[] | null | undefined;

    // undefined wegen Updates
    @OneToOne(() => Marke, (marke) => marke.laptop, {
        cascade: ['insert', 'remove'],
    })
    readonly marke: Marke | undefined;

    // undefined wegen Updates
    @OneToMany(() => LaptopBild, (laptopBild) => laptopBild.laptop, {
        cascade: ['insert', 'remove'],
    })
    readonly laptopBilden: LaptopBild[] | undefined;

    @OneToOne(() => LaptopDatei, (laptopDatei) => laptopDatei.laptop, {
        cascade: ['insert', 'remove'],
    })
    readonly datei: LaptopDatei | undefined;

    // https://typeorm.io/entities#special-columns
    // https://typeorm.io/entities#column-types-for-postgres
    // https://typeorm.io/entities#column-types-for-mysql--mariadb
    // https://typeorm.io/entities#column-types-for-sqlite--cordova--react-native--expo
    @CreateDateColumn({
        type: dbType === 'sqlite' ? 'datetime' : 'timestamp',
    })
    readonly erzeugt: Date | undefined;

    @UpdateDateColumn({
        type: dbType === 'sqlite' ? 'datetime' : 'timestamp',
    })
    readonly aktualisiert: Date | undefined;

    public toString = (): string =>
        JSON.stringify({
            id: this.id,
            version: this.version,
            modellnummer: this.modellnummer,
            art: this.art,
            preis: this.preis,
            rabatt: this.rabatt,
            lieferbar: this.lieferbar,
            datum: this.datum,
            homepage: this.homepage,
            merkmale: this.merkmale,
            erzeugt: this.erzeugt,
            aktualisiert: this.aktualisiert,
        });
}

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
 * Das Modul besteht aus der Entity-Klasse.
 * @packageDocumentation
 */

/* eslint-disable max-classes-per-file, @typescript-eslint/no-magic-numbers */

import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
    ArrayUnique,
    IsArray,
    IsBoolean,
    IsString,
    IsISO8601,
    IsOptional,
    IsUrl,
    Matches,
    Validate,
    ValidateNested,
    type ValidationArguments,
    ValidatorConstraint,
    type ValidatorConstraintInterface,
} from 'class-validator';
import Decimal from 'decimal.js'; // eslint-disable-line @typescript-eslint/naming-convention
import { type LaptopArt } from '../entity/laptop.entity.js';
import { LaptopBildDTO } from './laptopbildDTO.entity.js';
import { MarkeDTO } from './markeDTO.entity.js';

export const MAX_RATING = 5;

// https://github.com/typestack/class-transformer?tab=readme-ov-file#basic-usage
const number2Decimal = ({ value }: { value: Decimal.Value | undefined }) => {
    if (value === undefined) {
        return;
    }

    // Decimal aus decimal.js analog zu BigDecimal von Java
    // precision wie bei SQL beim Spaltentyp DECIMAL bzw. NUMERIC
    Decimal.set({ precision: 6 });
    return Decimal(value);
};

const number2Percent = ({ value }: { value: Decimal.Value | undefined }) => {
    if (value === undefined) {
        return;
    }

    // precision wie bei SQL beim Spaltentyp DECIMAL bzw. NUMERIC
    Decimal.set({ precision: 4 });
    return Decimal(value);
};

// https://github.com/typestack/class-validator?tab=readme-ov-file#custom-validation-classes
@ValidatorConstraint({ name: 'decimalMin', async: false })
class DecimalMin implements ValidatorConstraintInterface {
    validate(value: Decimal | undefined, args: ValidationArguments) {
        if (value === undefined) {
            return true;
        }
        const [minValue]: Decimal[] = args.constraints; // eslint-disable-line @typescript-eslint/no-unsafe-assignment
        return value.greaterThanOrEqualTo(minValue!);
    }

    defaultMessage(args: ValidationArguments) {
        return `Der Wert muss groesser oder gleich ${(args.constraints[0] as Decimal).toNumber()} sein.`;
    }
}

// https://github.com/typestack/class-validator?tab=readme-ov-file#custom-validation-classes
@ValidatorConstraint({ name: 'decimalMax', async: false })
class DecimalMax implements ValidatorConstraintInterface {
    validate(value: Decimal | undefined, args: ValidationArguments) {
        if (value === undefined) {
            return true;
        }
        const [maxValue]: Decimal[] = args.constraints; // eslint-disable-line @typescript-eslint/no-unsafe-assignment
        return value.lessThanOrEqualTo(maxValue!);
    }

    defaultMessage(args: ValidationArguments) {
        return `Der Wert muss kleiner oder gleich ${(args.constraints[0] as Decimal).toNumber()} sein.`;
    }
}

/**
 * Entity-Klasse für Bücher ohne TypeORM und ohne Referenzen.
 */
export class LaptopDtoOhneRef {
    // https://www.oreilly.com/library/view/regular-expressions-cookbook/9781449327453/ch04s13.html
    @IsString()
    @ApiProperty({ example: 'XPS-13-9320', type: String })
    readonly modellnummer!: string;

    @Matches(/^(ULTRABOOK|GAMING|BUSINESS)$/u)
    @IsOptional()
    @ApiProperty({ example: 'ULTRABOOK', type: String })
    readonly art: LaptopArt | undefined;

    // https://github.com/typestack/class-transformer?tab=readme-ov-file#basic-usage
    @Transform(number2Decimal)
    @Validate(DecimalMin, [Decimal(0)], {
        message: 'preis muss positiv sein.',
    })
    @ApiProperty({ example: 1, type: Number })
    // Decimal aus decimal.js analog zu BigDecimal von Java
    readonly preis!: Decimal;

    @Transform(number2Percent)
    @Validate(DecimalMin, [Decimal(0)], {
        message: 'rabatt muss positiv sein.',
    })
    @Validate(DecimalMax, [Decimal(1)], {
        message: 'rabatt muss kleiner 1 sein.',
    })
    @IsOptional()
    @ApiProperty({ example: 0.1, type: Number })
    readonly rabatt: Decimal | undefined;

    @IsBoolean()
    @IsOptional()
    @ApiProperty({ example: true, type: Boolean })
    readonly lieferbar: boolean | undefined;

    @IsISO8601({ strict: true })
    @IsOptional()
    @ApiProperty({ example: '2021-01-31' })
    readonly datum: Date | string | undefined;

    @IsUrl()
    @IsOptional()
    @ApiProperty({ example: 'https://test.de/', type: String })
    readonly homepage: string | undefined;

    @IsOptional()
    @ArrayUnique()
    @ApiProperty({
        example: ['TOUCHSCREEN', 'BACKLIT', 'LIGHTWEIGHT', 'BATTERY'],
    })
    readonly merkmale: string[] | undefined;
}

/**
 * Entity-Klasse für Laptop ohne TypeORM.
 */
export class LaptopDTO extends LaptopDtoOhneRef {
    @ValidateNested()
    @Type(() => MarkeDTO)
    @ApiProperty({ type: MarkeDTO })
    readonly marke!: MarkeDTO; // NOSONAR

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => LaptopBildDTO)
    @ApiProperty({ type: [LaptopBildDTO] })
    readonly laptopBilden: LaptopBildDTO[] | undefined;

    // LaptopBildDTO
}
/* eslint-enable max-classes-per-file, @typescript-eslint/no-magic-numbers */

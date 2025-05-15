// Copyright (C) 2023 - present Juergen Zimmermann, Hochschule Karlsruhe
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

import {
    Column,
    Entity,
    JoinColumn,
    OneToOne,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { Laptop } from './laptop.entity.js';

@Entity()
export class Marke {
    // https://typeorm.io/entities#primary-columns
    @PrimaryGeneratedColumn()
    id: number | undefined;

    @Column('varchar')
    readonly marke: string | undefined;

    @Column('varchar')
    readonly reihe: string | undefined;

    @OneToOne(() => Laptop, (laptop) => laptop.marke)
    @JoinColumn({ name: 'laptop_id' })
    laptop: Laptop | undefined;

    public toString = (): string =>
        JSON.stringify({
            id: this.id,
            name: this.marke,
            reihe: this.reihe,
        });
}

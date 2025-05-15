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

import { LaptopBild } from './laptopBild.entity.js';
import { Laptop } from './laptop.entity.js';
import { LaptopDatei } from './laptopDatei.entity.js';
import { Marke } from './marke.entity.js';

// erforderlich in src/config/db.ts und src/laptop/laptop.module.ts
export const entities = [LaptopBild, Laptop, LaptopDatei, Marke];

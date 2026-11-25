#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/2a84debc6917cb874ce4e912fda7f3c5d6002cd3334484c3a3b1100b6aad580a/contract';
import endContract from '../../snapshots/2a84debc6917cb874ce4e912fda7f3c5d6002cd3334484c3a3b1100b6aad580a/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/d04f3e3e05c4be33e4bcb6b48a4836be26c69d0f4ddfac5abe3525473e875ed4/contract';
import startContract from '../../snapshots/d04f3e3e05c4be33e4bcb6b48a4836be26c69d0f4ddfac5abe3525473e875ed4/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'MealPhoto',
        column: col('generated', 'bool', {
          notNull: true,
          default: lit(false),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);

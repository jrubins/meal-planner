#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/6dec37d2f475b6b9f68163d7d4bb0a8c3c29d7ea8c012859ec2683b36788a54d/contract';
import endContract from '../../snapshots/6dec37d2f475b6b9f68163d7d4bb0a8c3c29d7ea8c012859ec2683b36788a54d/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/fe894037f89a81637dba4ffc0c9bff8e147b454c4d8a382e8aff602d5a2f99cb/contract';
import startContract from '../../snapshots/fe894037f89a81637dba4ffc0c9bff8e147b454c4d8a382e8aff602d5a2f99cb/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'Meal',
        column: col('recipeText', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'MealPhoto',
        column: col('kind', 'text', {
          notNull: true,
          default: lit('meal'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'MealPhoto',
        column: col('readStatus', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);

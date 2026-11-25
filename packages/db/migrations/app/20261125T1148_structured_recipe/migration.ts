#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/6dec37d2f475b6b9f68163d7d4bb0a8c3c29d7ea8c012859ec2683b36788a54d/contract';
import startContract from '../../snapshots/6dec37d2f475b6b9f68163d7d4bb0a8c3c29d7ea8c012859ec2683b36788a54d/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/d04f3e3e05c4be33e4bcb6b48a4836be26c69d0f4ddfac5abe3525473e875ed4/contract';
import endContract from '../../snapshots/d04f3e3e05c4be33e4bcb6b48a4836be26c69d0f4ddfac5abe3525473e875ed4/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'Meal',
        column: col('recipe', 'json', { codecRef: { codecId: 'pg/json@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);

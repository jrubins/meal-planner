#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/fe894037f89a81637dba4ffc0c9bff8e147b454c4d8a382e8aff602d5a2f99cb/contract';
import endContract from '../../snapshots/fe894037f89a81637dba4ffc0c9bff8e147b454c4d8a382e8aff602d5a2f99cb/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
  sql,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<never, End> {
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createSchema({ schema: 'public' }),
      this.createTable({
        schema: 'public',
        table: 'Dinner',
        columns: [
          col('createdAt', 'timestamptz(3)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('date', 'date', { notNull: true, codecRef: { codecId: 'pg/date-string@1' } }),
          col('householdId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('mealId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('note', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('updatedByUserId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'DinnerOption',
        columns: [
          col('createdAt', 'timestamptz(3)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('date', 'date', { notNull: true, codecRef: { codecId: 'pg/date-string@1' } }),
          col('householdId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('mealId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('proposedByUserId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'Household',
        columns: [
          col('createdAt', 'timestamptz(3)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('inviteCode', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('timeZone', 'text', {
            notNull: true,
            default: lit('UTC'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updatedAt', 'timestamptz(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('weekStartsOn', 'int4', {
            notNull: true,
            default: lit(1),
            codecRef: { codecId: 'pg/int4@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'HouseholdMember',
        columns: [
          col('createdAt', 'timestamptz(3)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('displayName', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('householdId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'Meal',
        columns: [
          col('createdAt', 'timestamptz(3)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('createdByUserId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('householdId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('recipeUrl', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('tags', 'text[]', { notNull: true, codecRef: { codecId: 'pg/text@1', many: true } }),
          col('updatedAt', 'timestamptz(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'Meal_tags_elem_not_null_aecbe9e2',
            sql`array_position("tags", NULL) IS NULL`,
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'MealPhoto',
        columns: [
          col('contentType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz(3)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('data', 'bytea', { notNull: true, codecRef: { codecId: 'pg/bytea@1' } }),
          col('householdId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('mealId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'OptionVote',
        columns: [
          col('createdAt', 'timestamptz(3)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('optionId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('updatedAt', 'timestamptz(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('value', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Dinner',
        constraint: 'Dinner_householdId_date_key',
        columns: ['householdId', 'date'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'DinnerOption',
        constraint: 'DinnerOption_householdId_date_mealId_key',
        columns: ['householdId', 'date', 'mealId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Household',
        constraint: 'Household_inviteCode_key',
        columns: ['inviteCode'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'HouseholdMember',
        constraint: 'HouseholdMember_userId_key',
        columns: ['userId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'OptionVote',
        constraint: 'OptionVote_optionId_userId_key',
        columns: ['optionId', 'userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Dinner',
        index: 'Dinner_mealId_idx_12b177d9',
        columns: ['mealId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'DinnerOption',
        index: 'DinnerOption_mealId_idx_12b177d9',
        columns: ['mealId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'HouseholdMember',
        index: 'HouseholdMember_householdId_idx_fb33d798',
        columns: ['householdId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Meal',
        index: 'Meal_householdId_createdAt_idx_6b6c436d',
        columns: ['householdId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Meal',
        index: 'Meal_householdId_idx_fb33d798',
        columns: ['householdId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'MealPhoto',
        index: 'MealPhoto_mealId_createdAt_idx_1052d642',
        columns: ['mealId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'MealPhoto',
        index: 'MealPhoto_mealId_idx_12b177d9',
        columns: ['mealId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'OptionVote',
        index: 'OptionVote_optionId_idx_b1d5fce5',
        columns: ['optionId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Dinner',
        foreignKey: {
          name: 'Dinner_mealId_fkey',
          columns: ['mealId'],
          references: { schema: 'public', table: 'Meal', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'DinnerOption',
        foreignKey: {
          name: 'DinnerOption_mealId_fkey',
          columns: ['mealId'],
          references: { schema: 'public', table: 'Meal', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'HouseholdMember',
        foreignKey: {
          name: 'HouseholdMember_householdId_fkey',
          columns: ['householdId'],
          references: { schema: 'public', table: 'Household', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Meal',
        foreignKey: {
          name: 'Meal_householdId_fkey',
          columns: ['householdId'],
          references: { schema: 'public', table: 'Household', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'MealPhoto',
        foreignKey: {
          name: 'MealPhoto_mealId_fkey',
          columns: ['mealId'],
          references: { schema: 'public', table: 'Meal', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'OptionVote',
        foreignKey: {
          name: 'OptionVote_optionId_fkey',
          columns: ['optionId'],
          references: { schema: 'public', table: 'DinnerOption', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);

import type { Db } from '@app/db';
import type { PhotoContentType } from '@app/shared';

export interface StoredPhoto {
  id: number;
  mealId: number;
  createdAt: Date;
}

export interface PhotoContent {
  contentType: string;
  data: Uint8Array;
}

/**
 * Where meal photos live. Everything that reads or writes photo bytes goes through this
 * interface, and clients only ever see the API path that serves a photo, so moving photos to
 * blob storage (Vercel Blob, S3, R2) is a new implementation of this interface plus a one-off
 * copy of the existing rows. Nothing else changes.
 */
export interface PhotoStore {
  save(input: {
    householdId: number;
    mealId: number;
    contentType: PhotoContentType;
    data: Uint8Array;
  }): Promise<StoredPhoto>;
  /** Photo metadata (no bytes) for these meals, oldest first. */
  list(householdId: number, mealIds: readonly number[]): Promise<StoredPhoto[]>;
  read(householdId: number, mealId: number, photoId: number): Promise<PhotoContent | null>;
  /** True when a photo was removed. */
  remove(householdId: number, mealId: number, photoId: number): Promise<boolean>;
}

/** Stores photos in Postgres (a `bytea` column): simple, and plenty for a household. */
export function createPostgresPhotoStore(db: Db): PhotoStore {
  const Photos = db.orm.public.MealPhoto;
  return {
    async save({ householdId, mealId, contentType, data }) {
      const row = await Photos.select('id', 'mealId', 'createdAt').create({
        householdId,
        mealId,
        contentType,
        data,
      });
      return row;
    },

    async list(householdId, mealIds) {
      if (mealIds.length === 0) return [];
      return Photos.where({ householdId })
        .where((p) => p.mealId.in([...mealIds]))
        .select('id', 'mealId', 'createdAt')
        .orderBy([(p) => p.createdAt.asc(), (p) => p.id.asc()])
        .limit(2000)
        .all();
    },

    async read(householdId, mealId, photoId) {
      return Photos.where({ id: photoId, mealId, householdId })
        .select('contentType', 'data')
        .first();
    },

    async remove(householdId, mealId, photoId) {
      const deleted = await Photos.where({ id: photoId, mealId, householdId })
        .select('id')
        .delete();
      return deleted !== null;
    },
  };
}

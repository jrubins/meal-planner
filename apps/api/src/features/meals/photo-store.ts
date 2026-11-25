import type { Db } from '@app/db';
import type { PhotoContentType, PhotoKind, RecipeReadStatus } from '@app/shared';

export interface StoredPhoto {
  id: number;
  mealId: number;
  kind: string;
  readStatus: string | null;
  generated: boolean;
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
    kind: PhotoKind;
    readStatus: RecipeReadStatus | null;
    /** Made by an AI image model rather than uploaded. */
    generated?: boolean;
    contentType: PhotoContentType;
    data: Uint8Array;
  }): Promise<StoredPhoto>;
  /** Photo metadata (no bytes) for these meals, oldest first. */
  list(householdId: number, mealIds: readonly number[]): Promise<StoredPhoto[]>;
  read(householdId: number, mealId: number, photoId: number): Promise<PhotoContent | null>;
  /** True when a photo was removed. */
  remove(householdId: number, mealId: number, photoId: number): Promise<boolean>;
  /** Records how reading a recipe photo went. */
  setReadStatus(photoId: number, status: RecipeReadStatus): Promise<void>;
}

/** Stores photos in Postgres (a `bytea` column): simple, and plenty for a household. */
export function createPostgresPhotoStore(db: Db): PhotoStore {
  const Photos = db.orm.public.MealPhoto;
  return {
    async save({ householdId, mealId, kind, readStatus, generated = false, contentType, data }) {
      return Photos.select('id', 'mealId', 'kind', 'readStatus', 'generated', 'createdAt').create({
        householdId,
        mealId,
        kind,
        readStatus,
        generated,
        contentType,
        data,
      });
    },

    async list(householdId, mealIds) {
      if (mealIds.length === 0) return [];
      return Photos.where({ householdId })
        .where((p) => p.mealId.in([...mealIds]))
        .select('id', 'mealId', 'kind', 'readStatus', 'generated', 'createdAt')
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

    async setReadStatus(photoId, status) {
      await Photos.where({ id: photoId }).select('id').update({ readStatus: status });
    },
  };
}

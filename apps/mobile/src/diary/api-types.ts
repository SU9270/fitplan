import type { InferResponseType } from 'hono/client';
import type { api } from '../lib/api';

/** Response shapes, inferred from the API routes so they cannot drift from the server. */
export type FoodSummary = InferResponseType<typeof api.api.foods.$get, 200>['foods'][number];
export type FoodDetail = InferResponseType<(typeof api.api.foods)[':id']['$get'], 200>['food'];
export type DiaryDay = InferResponseType<typeof api.api.diary.$get, 200>;
export type DiaryEntry = DiaryDay['entries'][number];

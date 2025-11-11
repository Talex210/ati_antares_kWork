// src/core/types.ts

/**
 * Описывает структуру объекта груза, получаемого от API.
 */
export interface Load {
  id: number;
  title: string;
  creator: {
    id: number;
    name: string;
    phone: string;
  };
  datePublished: string;
  price: number;
  cargoType: string;
  weight: number;
  volume: number;
  route: { from: string; to: string };
}

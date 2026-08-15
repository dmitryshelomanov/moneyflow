import type {
  Category,
  CreateCategory,
  UpdateCategory,
} from "@moneyflow/shared";
import { request } from "@/shared/api/http";

export const categoryApi = {
  categories: () => request<Category[]>("/categories"),
  createCategory: (body: CreateCategory) =>
    request<Category>("/categories", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateCategory: (id: string, body: UpdateCategory) =>
    request<Category>(`/categories/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteCategory: (id: string) =>
    request<{ ok: boolean }>(`/categories/${id}`, { method: "DELETE" }),
};

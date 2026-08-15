import { useQuery } from "@tanstack/react-query";
import { categoryApi } from "@/entities/category/api/category-api";

export const categoryKeys = {
  all: ["categories"] as const,
};

export function useCategoriesQuery() {
  return useQuery({
    queryKey: categoryKeys.all,
    queryFn: categoryApi.categories,
  });
}

/** Avoid "xqcicsr xqcicsr" when catalog name equals slug. */
export function packageNamesDiffer(name: string, slug: string): boolean {
  return name.trim().toLowerCase() !== slug.trim().toLowerCase();
}

export function formatPackageListLabel(name: string, slug: string): string {
  return packageNamesDiffer(name, slug) ? name.trim() : slug.trim();
}

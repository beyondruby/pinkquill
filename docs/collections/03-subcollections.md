# Subcollections restored

Collections now have an optional `parent_id`. A root collection holds works and one level of subcollections; each subcollection uses the same work picker, editor, ordering and removal controls. Studio shelves show roots only. Composer and membership pickers label children with their parent name.

Apply `supabase/migrations/20260916_restore_subcollections.sql` after the flatten migration and before deploying this UI. It restores archived collection items as child collections, keeps their IDs and available slugs, moves the flattened duplicate memberships back into their subcollections, and leaves the archive tables intact. Parent shelf counts and previews include distinct visible works from children. Deleting a parent deletes its subcollections and memberships, while posts remain published.

The full page and modal share a frosted header with owner actions in the top-right overflow menu. Studio cards retain the fanned prints inside a light glass panel. Original `/studio/:username/collections/:collection/:item` addresses remain available.

Validation: TypeScript, targeted ESLint, collection component tests, desktop/mobile browser checks with the migrated shelf response, and both SQL migrations executed in an isolated PostgreSQL-compatible PGlite database. SQL checks cover legacy IDs, slugs and memberships, parent counts, child creation, ownership and depth rejection, and deletion preserving works. The remote database migration has not been applied from this workspace.

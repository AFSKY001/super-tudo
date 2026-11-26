-- Move existing personal routine activities and completion flags to the
-- dedicated routine permission. The client now writes these modules as r:rot.
-- Keep routineModels and routineAssignments on r:cro (administrative permission).
-- Traditional checklist data (ck/runs) and legacy cronograma data are untouched.

update public.app_records
   set kind = 'r:rot'
 where module in ('pt', 'done')
   and kind = 'r:cro';

-- Safe undo, only BEFORE any new writes to pt/done as r:rot after this migration:
-- update public.app_records
--    set kind = 'r:cro'
--  where module in ('pt', 'done')
--    and kind = 'r:rot';
-- If the app has already written or modified these records after migration,
-- do not run this undo blindly; reconcile each record and its revision first.

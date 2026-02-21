-- Fix M-4: Role enum mismatch between database, edge function, and frontend
-- The database had: admin, office_manager, inspector, engineer, construction_manager
-- The frontend/edge function used: admin, office_manager, field_ops, engineer
-- This migration aligns them by adding the missing values to the enum.

ALTER TYPE public.ops_role ADD VALUE IF NOT EXISTS 'field_ops';
-- Note: inspector and construction_manager already exist in the enum.
-- The edge function VALID_ROLES and frontend types are updated in this same PR.

-- Add notas_internas column to encuestas table
ALTER TABLE public.encuestas 
ADD COLUMN notas_internas TEXT;
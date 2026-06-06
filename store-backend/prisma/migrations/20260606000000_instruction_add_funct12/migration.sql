-- Add funct12 (12-bit I-immediate) to support I-singleton encodings
-- (brev8/rev8/zip/unzip and scalar-crypto fixed-imm instructions) where rs2
-- is part of the immediate. The previous schema only had (opcode, funct3, funct7),
-- so I-singleton encodings persisted with funct7=NULL and false-collided with
-- every other instruction sharing the same (opcode, funct3) tuple.

-- AlterTable
ALTER TABLE "Instruction" ADD COLUMN "funct12" INTEGER;

-- Replace the old (opcode, funct3, funct7) index with one that includes funct12
-- so collision lookups can distinguish I-singleton from R-type at the same opcode.
DROP INDEX IF EXISTS "Instruction_opcode_funct3_funct7_idx";
CREATE INDEX "Instruction_opcode_funct3_funct7_funct12_idx"
  ON "Instruction"("opcode", "funct3", "funct7", "funct12");

/*
  Warnings:

  - A unique constraint covering the columns `[userId,normalizedName]` on the table `Tag` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `normalizedName` to the `Tag` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "NoteTag" DROP CONSTRAINT "NoteTag_noteId_fkey";

-- DropForeignKey
ALTER TABLE "NoteTag" DROP CONSTRAINT "NoteTag_tagId_fkey";

-- DropIndex
DROP INDEX "Tag_userId_name_key";

-- AlterTable
ALTER TABLE "Tag" ADD COLUMN     "normalizedName" VARCHAR(50) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Tag_userId_normalizedName_key" ON "Tag"("userId", "normalizedName");

-- AddForeignKey
ALTER TABLE "NoteTag" ADD CONSTRAINT "NoteTag_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteTag" ADD CONSTRAINT "NoteTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

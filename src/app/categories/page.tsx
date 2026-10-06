"use client";

import { useState } from "react";
import { Edit, FolderPlus, FolderTree, Layers, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Field, Input, Select, Textarea } from "@/components/ui/Form";
import { Modal, ConfirmDialog } from "@/components/ui/Modal";
import { Table, TBody, Td, Th, THead } from "@/components/ui/Table";
import { EmptyState, LoadingState } from "@/components/ui/States";
import { useAuth } from "@/hooks/useAuth";
import { useBooks, useCategories } from "@/hooks/useRealtime";
import { createCategory, deleteCategory, updateCategory, type CategoryInput } from "@/services/category.service";
import { errorMessage } from "@/utils/errors";
import type { ActiveStatus, Category } from "@/types";

export default function CategoriesPage() {
  const { can } = useAuth();
  const { data: categories, loading, error } = useCategories();
  const { data: books } = useBooks();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [form, setForm] = useState<CategoryInput>({
    name: "",
    description: "",
    status: "active",
  });
  const [saving, setSaving] = useState(false);

  const [deletingCat, setDeletingCat] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);

  const bookCountMap = new Map<string, number>();
  books.forEach((b) => {
    if (b.categoryId) {
      bookCountMap.set(b.categoryId, (bookCountMap.get(b.categoryId) || 0) + 1);
    }
  });

  const openCreate = () => {
    setEditingCat(null);
    setForm({ name: "", description: "", status: "active" });
    setModalOpen(true);
  };

  const openEdit = (c: Category) => {
    setEditingCat(c);
    setForm({ name: c.name, description: c.description || "", status: c.status });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Vui lòng nhập tên thể loại");
      return;
    }
    setSaving(true);
    try {
      if (editingCat) {
        await updateCategory(editingCat.id, form);
        toast.success("Cập nhật thể loại thành công");
      } else {
        await createCategory(form);
        toast.success("Tạo thể loại mới thành công");
      }
      setModalOpen(false);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingCat) return;
    setDeleting(true);
    try {
      await deleteCategory(deletingCat.id);
      toast.success("Đã xóa thể loại");
      setDeletingCat(null);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Danh mục Thể loại Sách"
        description="Quản lý các nhóm chuyên ngành và phân loại tài liệu trong thư viện"
        actions={
          can("category:write") && (
            <Button variant="primary" size="sm" icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
              Thêm thể loại
            </Button>
          )
        }
      />

      <Card>
        {loading && categories.length === 0 ? (
          <LoadingState label="Đang tải danh mục thể loại..." />
        ) : categories.length === 0 ? (
          <EmptyState title="Chưa có thể loại nào" description="Bấm nút 'Thêm thể loại' để tạo nhóm đầu tiên" />
        ) : (
          <Table>
            <THead>
              <tr>
                <Th>Tên thể loại</Th>
                <Th>Mô tả</Th>
                <Th className="text-right">Số đầu sách hiện có</Th>
                <Th>Trạng thái</Th>
                <Th className="text-center">Thao tác</Th>
              </tr>
            </THead>
            <TBody>
              {categories.map((c) => {
                const count = bookCountMap.get(c.id) || 0;
                return (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <Td className="font-semibold text-xs text-slate-900">{c.name}</Td>
                    <Td className="text-xs text-slate-500 max-w-[280px] truncate">{c.description || "—"}</Td>
                    <Td className="text-right font-bold text-xs text-blue-600">{count} đầu sách</Td>
                    <Td>
                      <Badge color={c.status === "active" ? "green" : "red"}>
                        {c.status === "active" ? "Hoạt động" : "Tạm khóa"}
                      </Badge>
                    </Td>
                    <Td className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        {can("category:write") && (
                          <button
                            onClick={() => openEdit(c)}
                            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-amber-600"
                            title="Sửa thể loại"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                        )}
                        {can("category:delete") && (
                          <button
                            onClick={() => setDeletingCat(c)}
                            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-red-600"
                            title="Xóa thể loại"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </TBody>
          </Table>
        )}
      </Card>

      {/* Modal Thêm / Sửa */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingCat ? "Sửa thể loại" : "Thêm thể loại mới"}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Hủy
            </Button>
            <Button variant="primary" onClick={handleSave} loading={saving}>
              {editingCat ? "Lưu thay đổi" : "Tạo thể loại"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Tên thể loại" required>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Ví dụ: Công nghệ thông tin..."
              required
            />
          </Field>
          <Field label="Mô tả">
            <Textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Mô tả nhóm sách..."
            />
          </Field>
          <Field label="Trạng thái">
            <Select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ActiveStatus }))}
            >
              <option value="active">Hoạt động</option>
              <option value="disabled">Tạm khóa</option>
            </Select>
          </Field>
        </div>
      </Modal>

      {/* Confirm Xóa */}
      <ConfirmDialog
        open={Boolean(deletingCat)}
        onClose={() => setDeletingCat(null)}
        onConfirm={handleDelete}
        title="Xác nhận xóa thể loại"
        danger
        loading={deleting}
        confirmText="Xác nhận xóa"
        message={`Bạn có chắc muốn xóa thể loại "${deletingCat?.name}"? Hệ thống sẽ từ chối nếu có sách đang thuộc thể loại này.`}
      />
    </AppShell>
  );
}

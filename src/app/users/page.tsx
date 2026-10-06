"use client";

import { useEffect, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import {
  Edit,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  Plus,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Unlock,
  UserCheck,
  UserCog,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Field, Input, Select } from "@/components/ui/Form";
import { Modal, ConfirmDialog } from "@/components/ui/Modal";
import { Table, TBody, Td, Th, THead } from "@/components/ui/Table";
import { EmptyState, LoadingState } from "@/components/ui/States";
import { useAuth } from "@/hooks/useAuth";
import { COLLECTIONS, ROLE_LABELS } from "@/lib/constants";
import { col, snapToData } from "@/lib/firestore";
import { createUserAccount, updateUserAccount, type NewUserInput } from "@/services/auth.service";
import { formatDate } from "@/utils/format";
import { errorMessage } from "@/utils/errors";
import type { ActiveStatus, AppUser, Role } from "@/types";

export default function UsersPage() {
  const { can, profile: myProfile } = useAuth();

  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal Tạo Tài Khoản Mới
  const [createModal, setCreateModal] = useState(false);
  const [showNewUserPass, setShowNewUserPass] = useState(false);
  const [newForm, setNewForm] = useState<NewUserInput>({
    fullName: "",
    email: "",
    password: "",
    role: "librarian",
  });
  const [creating, setCreating] = useState(false);

  // Modal Sửa Tài Khoản
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [editForm, setEditForm] = useState<{ fullName: string; role: Role; status: ActiveStatus }>({
    fullName: "",
    role: "librarian",
    status: "active",
  });
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(
      col(COLLECTIONS.users),
      (snap) => {
        const list = snap.docs
          .map((d) => snapToData<AppUser>(d))
          .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
        setUsers(list);
        setLoading(false);
      },
      (err) => {
        toast.error(`Lỗi tải danh sách người dùng: ${errorMessage(err)}`);
        setLoading(false);
      },
    );
    return () => unsub();
  }, []);

  const handleCreate = async () => {
    if (!newForm.fullName.trim() || !newForm.email.trim() || !newForm.password) {
      toast.error("Vui lòng điền đầy đủ thông tin");
      return;
    }
    if (newForm.password.length < 6) {
      toast.error("Mật khẩu tối thiểu 6 ký tự");
      return;
    }
    setCreating(true);
    try {
      await createUserAccount(newForm);
      toast.success(`Đã tạo tài khoản cho ${newForm.email}`);
      setCreateModal(false);
      setNewForm({ fullName: "", email: "", password: "", role: "librarian" });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;
    if (!editForm.fullName.trim()) {
      toast.error("Vui lòng nhập họ tên");
      return;
    }
    if (editingUser.id === myProfile?.id && editForm.role !== "admin") {
      toast.error("Không thể tự hạ quyền Admin của chính mình");
      return;
    }
    if (editingUser.id === myProfile?.id && editForm.status === "disabled") {
      toast.error("Không thể tự khóa tài khoản của chính mình");
      return;
    }
    setSavingEdit(true);
    try {
      await updateUserAccount(editingUser.id, editForm);
      toast.success("Cập nhật tài khoản thành công");
      setEditingUser(null);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSavingEdit(false);
    }
  };

  const openEdit = (u: AppUser) => {
    setEditingUser(u);
    setEditForm({
      fullName: u.fullName,
      role: u.role,
      status: u.status,
    });
  };

  if (!can("user:manage")) {
    return (
      <AppShell>
        <Card className="p-8 text-center max-w-md mx-auto">
          <ShieldAlert className="mx-auto h-12 w-12 text-red-500 mb-2" />
          <h2 className="text-base font-bold text-slate-900">Không đủ quyền truy cập</h2>
          <p className="text-xs text-slate-500 mt-1">Chỉ Quản trị viên (Admin) mới có quyền quản lý người dùng và phân quyền hệ thống.</p>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title="Quản lý Người dùng & Phân quyền"
        description="Tạo tài khoản cán bộ, thủ thư và thiết lập quyền truy cập hệ thống"
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => setCreateModal(true)}
          >
            Tạo tài khoản mới
          </Button>
        }
      />

      <Card>
        {loading && users.length === 0 ? (
          <LoadingState label="Đang tải danh sách người dùng..." />
        ) : (
          <Table>
            <THead>
              <tr>
                <Th>Họ và tên</Th>
                <Th>Email đăng nhập</Th>
                <Th>Vai trò / Phân quyền</Th>
                <Th>Trạng thái</Th>
                <Th>Ngày tạo</Th>
                <Th className="text-center">Thao tác</Th>
              </tr>
            </THead>
            <TBody>
              {users.map((u) => {
                const isMe = u.id === myProfile?.id;
                return (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <Td className="font-semibold text-xs text-slate-900">
                      {u.fullName} {isMe && <span className="text-[10px] text-blue-600 font-normal">(Bạn)</span>}
                    </Td>
                    <Td className="text-xs text-slate-600 font-mono">{u.email}</Td>
                    <Td>
                      <Badge
                        color={u.role === "admin" ? "violet" : u.role === "librarian" ? "blue" : "slate"}
                      >
                        <Shield className="h-3 w-3 mr-0.5" />
                        {ROLE_LABELS[u.role] || u.role}
                      </Badge>
                    </Td>
                    <Td>
                      <Badge color={u.status === "active" ? "green" : "red"}>
                        {u.status === "active" ? "Hoạt động" : "Đã khóa"}
                      </Badge>
                    </Td>
                    <Td className="text-xs text-slate-500 whitespace-nowrap">{formatDate(u.createdAt)}</Td>
                    <Td className="text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        icon={<Edit className="h-3.5 w-3.5" />}
                        onClick={() => openEdit(u)}
                      >
                        Sửa
                      </Button>
                    </Td>
                  </tr>
                );
              })}
            </TBody>
          </Table>
        )}
      </Card>

      {/* Modal Tạo Tài Khoản */}
      <Modal
        open={createModal}
        onClose={() => setCreateModal(false)}
        title="Tạo tài khoản cán bộ / thủ thư mới"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateModal(false)} disabled={creating}>
              Hủy
            </Button>
            <Button variant="primary" onClick={handleCreate} loading={creating}>
              Tạo tài khoản
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Họ và tên" required>
            <Input
              value={newForm.fullName}
              onChange={(e) => setNewForm((f) => ({ ...f, fullName: e.target.value }))}
              placeholder="Nguyễn Văn Thủ Thư"
              required
            />
          </Field>

          <Field label="Email đăng nhập" required>
            <Input
              type="email"
              value={newForm.email}
              onChange={(e) => setNewForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="thuthu@thuvien.local"
              required
            />
          </Field>

          <Field label="Mật khẩu khởi tạo (tối thiểu 6 ký tự)" required>
            <div className="relative">
              <Input
                type={showNewUserPass ? "text" : "password"}
                value={newForm.password}
                onChange={(e) => setNewForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="••••••••"
                required
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNewUserPass((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none p-1"
                title={showNewUserPass ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showNewUserPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>

          <Field label="Vai trò / Quyền hạn" required>
            <Select
              value={newForm.role}
              onChange={(e) => setNewForm((f) => ({ ...f, role: e.target.value as Role }))}
            >
              <option value="librarian">Thủ thư (Librarian) - Quản lý sách, mượn/trả, nhập kho, kiểm kê</option>
              <option value="admin">Quản trị viên (Admin) - Toàn quyền quản lý người dùng, cài đặt, xóa</option>
              <option value="viewer">Người xem (Viewer) - Chỉ xem thống kê và tra cứu sách</option>
            </Select>
          </Field>
        </div>
      </Modal>

      {/* Modal Sửa Quyền Hạn / Khóa Tài Khoản */}
      <Modal
        open={Boolean(editingUser)}
        onClose={() => setEditingUser(null)}
        title={`Chỉnh sửa tài khoản: ${editingUser?.email}`}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditingUser(null)} disabled={savingEdit}>
              Hủy
            </Button>
            <Button variant="primary" onClick={handleSaveEdit} loading={savingEdit}>
              Lưu thay đổi
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Họ và tên" required>
            <Input
              value={editForm.fullName}
              onChange={(e) => setEditForm((f) => ({ ...f, fullName: e.target.value }))}
              required
            />
          </Field>

          <Field label="Vai trò / Phân quyền" required>
            <Select
              value={editForm.role}
              onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value as Role }))}
            >
              <option value="librarian">Thủ thư (Librarian)</option>
              <option value="admin">Quản trị viên (Admin)</option>
              <option value="viewer">Người xem (Viewer)</option>
            </Select>
          </Field>

          <Field label="Trạng thái tài khoản" required>
            <Select
              value={editForm.status}
              onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value as ActiveStatus }))}
            >
              <option value="active">Đang hoạt động</option>
              <option value="disabled">Vô hiệu hóa (Khóa tài khoản)</option>
            </Select>
          </Field>
        </div>
      </Modal>
    </AppShell>
  );
}

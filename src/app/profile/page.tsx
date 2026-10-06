"use client";

import { useState, type FormEvent } from "react";
import { Eye, EyeOff, KeyRound, Shield, User, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Form";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/hooks/useAuth";
import { ROLE_LABELS } from "@/lib/constants";
import { changePassword, updateMyName } from "@/services/auth.service";
import { errorMessage } from "@/utils/errors";
import { formatDate } from "@/utils/format";

export default function ProfilePage() {
  const { profile, firebaseUser } = useAuth();

  const [fullName, setFullName] = useState(profile?.fullName || "");
  const [updatingName, setUpdatingName] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [changingPass, setChangingPass] = useState(false);

  const handleUpdateName = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!fullName.trim()) {
      toast.error("Vui lòng nhập họ và tên");
      return;
    }
    setUpdatingName(true);
    try {
      await updateMyName(profile.id, fullName);
      toast.success("Cập nhật họ tên thành công!");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setUpdatingName(false);
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      toast.error("Vui lòng nhập đầy đủ thông tin mật khẩu");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Mật khẩu mới phải có tối thiểu 6 ký tự");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Xác nhận mật khẩu mới không khớp");
      return;
    }
    setChangingPass(true);
    try {
      await changePassword(currentPassword, newPassword);
      toast.success("Đổi mật khẩu thành công!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setChangingPass(false);
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Thông tin tài khoản"
        description="Quản lý hồ sơ cá nhân và bảo mật mật khẩu của bạn"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Thông tin cá nhân */}
        <Card>
          <CardHeader title="Hồ sơ cá nhân" icon={<User className="h-5 w-5" />} />
          <CardBody>
            <form onSubmit={handleUpdateName} className="space-y-4">
              <Field label="Email đăng nhập">
                <Input value={profile?.email || firebaseUser?.email || ""} disabled className="bg-slate-50 text-slate-500" />
              </Field>

              <Field label="Vai trò / Phân quyền">
                <div className="flex items-center gap-2 pt-1">
                  <Badge color="blue" className="text-sm px-3 py-1">
                    <Shield className="h-4 w-4 mr-1" />
                    {profile?.role ? ROLE_LABELS[profile.role] : "Chưa xác định"}
                  </Badge>
                  <span className="text-xs text-slate-500">Phân quyền do Quản trị viên chỉ định</span>
                </div>
              </Field>

              <Field label="Ngày tạo tài khoản">
                <p className="text-sm text-slate-700 pt-1 font-medium">{formatDate(profile?.createdAt)}</p>
              </Field>

              <Field label="Họ và tên hiển thị" required>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nhập họ và tên..."
                  required
                />
              </Field>

              <div className="pt-2">
                <Button type="submit" loading={updatingName} variant="primary">
                  Cập nhật thông tin
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>

        {/* Đổi mật khẩu */}
        <Card id="password">
          <CardHeader title="Đổi mật khẩu" icon={<KeyRound className="h-5 w-5" />} />
          <CardBody>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <Field label="Mật khẩu hiện tại" required>
                <div className="relative">
                  <Input
                    type={showCurrentPass ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none p-1"
                    title={showCurrentPass ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  >
                    {showCurrentPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Field>

              <Field label="Mật khẩu mới (tối thiểu 6 ký tự)" required>
                <div className="relative">
                  <Input
                    type={showNewPass ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none p-1"
                    title={showNewPass ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  >
                    {showNewPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Field>

              <Field label="Xác nhận mật khẩu mới" required>
                <Input
                  type={showNewPass ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </Field>

              <div className="pt-2">
                <Button type="submit" loading={changingPass} variant="primary">
                  Đổi mật khẩu
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}

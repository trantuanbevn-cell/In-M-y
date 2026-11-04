-- Đã áp dụng lên project inmay (octgcomcfhspldehdvev) ngày 04/11/2026.
-- Lưu lại đây để theo dõi lịch sử schema.

-- 1. Vai trò: người đăng ký mới mặc định là 'pending' (không có quyền quản trị)
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role = any (array['admin'::text,'owner'::text,'pending'::text]));
alter table public.profiles alter column role set default 'pending';

-- 2. Hàm kiểm tra quyền quản trị
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('admin','owner')
  );
$$;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- 3. Cố định search_path và thu hồi quyền gọi công khai
alter function public.set_updated_at() set search_path = '';
alter function public.handle_new_user() set search_path = '';
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- 4. Viết lại policy: chỉ admin/owner được ghi
drop policy if exists categories_admin_write on public.categories;
drop policy if exists collections_admin_write on public.collections;
drop policy if exists cp_admin_write on public.collection_products;
drop policy if exists products_admin_write on public.products;
drop policy if exists settings_admin_write on public.settings;
drop policy if exists orders_admin_all on public.orders;
drop policy if exists categories_public_read on public.categories;
drop policy if exists collections_public_read on public.collections;
drop policy if exists products_public_read on public.products;
drop policy if exists orders_public_insert on public.orders;

create policy categories_read on public.categories for select using (is_active = true or (select public.is_admin()));
create policy collections_read on public.collections for select using (is_active = true or (select public.is_admin()));
create policy products_read on public.products for select using (is_active = true or (select public.is_admin()));

create policy categories_admin_write on public.categories for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy collections_admin_write on public.collections for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy cp_admin_write on public.collection_products for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy products_admin_write on public.products for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy settings_admin_write on public.settings for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy orders_admin_all on public.orders for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- 5. Khách chỉ được tạo đơn mới, có kiểm tra dữ liệu cơ bản
create policy orders_public_insert on public.orders for insert to anon, authenticated
with check (
  status = 'new'
  and admin_notes is null
  and char_length(customer_name) between 1 and 120
  and char_length(customer_phone) between 6 and 20
  and coalesce(char_length(customer_address), 0) <= 500
  and coalesce(char_length(customer_email), 0) <= 200
  and coalesce(char_length(notes), 0) <= 2000
  and quantity between 1 and 1000
);

-- 6. Storage: ai cũng xem ảnh (bucket public), chỉ admin được tải lên/sửa/xoá
create policy product_images_admin_select on storage.objects for select to authenticated using (bucket_id = 'product-images' and (select public.is_admin()));
create policy product_images_admin_insert on storage.objects for insert to authenticated with check (bucket_id = 'product-images' and (select public.is_admin()));
create policy product_images_admin_update on storage.objects for update to authenticated using (bucket_id = 'product-images' and (select public.is_admin())) with check (bucket_id = 'product-images' and (select public.is_admin()));
create policy product_images_admin_delete on storage.objects for delete to authenticated using (bucket_id = 'product-images' and (select public.is_admin()));

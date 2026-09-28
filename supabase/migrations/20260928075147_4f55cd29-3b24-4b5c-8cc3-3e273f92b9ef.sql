CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT USAGE ON SCHEMA private TO service_role;
REVOKE ALL ON SCHEMA private FROM anon;

CREATE OR REPLACE FUNCTION private.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION private.has_any_role(_user_id UUID, _roles app_role[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = ANY (_roles)
  )
$$;

CREATE OR REPLACE FUNCTION private.is_conversation_member(_conversation_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = _conversation_id AND user_id = _user_id
  )
$$;

GRANT EXECUTE ON FUNCTION private.has_role(UUID, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_any_role(UUID, app_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_conversation_member(UUID, UUID) TO authenticated;

DROP POLICY "Members can view their conversations" ON public.conversations;
DROP POLICY "Members can update their conversations" ON public.conversations;
DROP POLICY "Members can view participants" ON public.conversation_participants;
DROP POLICY "Members can add participants" ON public.conversation_participants;
DROP POLICY "Members can read messages" ON public.messages;
DROP POLICY "Members can send messages" ON public.messages;
DROP POLICY "Users read their own notifications" ON public.notifications;
DROP POLICY "Admins and principal review reports" ON public.user_reports;
DROP POLICY "Admins and principal update reports" ON public.user_reports;

CREATE POLICY "Members can view their conversations" ON public.conversations FOR SELECT TO authenticated USING (private.is_conversation_member(id, auth.uid()));
CREATE POLICY "Members can update their conversations" ON public.conversations FOR UPDATE TO authenticated USING (private.is_conversation_member(id, auth.uid()));
CREATE POLICY "Members can view participants" ON public.conversation_participants FOR SELECT TO authenticated USING (private.is_conversation_member(conversation_id, auth.uid()));
CREATE POLICY "Members can add participants" ON public.conversation_participants FOR INSERT TO authenticated WITH CHECK (private.is_conversation_member(conversation_id, auth.uid()) OR user_id = auth.uid());
CREATE POLICY "Members can read messages" ON public.messages FOR SELECT TO authenticated USING (private.is_conversation_member(conversation_id, auth.uid()));
CREATE POLICY "Members can send messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid() AND private.is_conversation_member(conversation_id, auth.uid()));
CREATE POLICY "Users read their own notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins and principal review reports" ON public.user_reports FOR SELECT TO authenticated USING (reporter_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'principal'::app_role));
CREATE POLICY "Admins and principal update reports" ON public.user_reports FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'principal'::app_role));

DROP FUNCTION public.has_role(UUID, app_role);
DROP FUNCTION public.has_any_role(UUID, app_role[]);
DROP FUNCTION public.is_conversation_member(UUID, UUID);
-- Run this in Supabase SQL Editor to set up all tables.

-- ─── Messages ────────────────────────────────────────────────────────────────
CREATE TABLE public.messages (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   timestamptz NOT NULL    DEFAULT now(),
  channel_id   text        NOT NULL,
  sender_name  text        NOT NULL,
  message_text text        NOT NULL,
  reply_to_id  uuid        REFERENCES public.messages(id) ON DELETE SET NULL
);

CREATE INDEX messages_channel_created
  ON public.messages (channel_id, created_at ASC);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_public_select"
  ON public.messages FOR SELECT USING (true);

CREATE POLICY "allow_public_insert"
  ON public.messages FOR INSERT WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- ─── Reactions ───────────────────────────────────────────────────────────────
CREATE TABLE public.reactions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  message_id  uuid        NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  sender_name text        NOT NULL,
  emoji       text        NOT NULL,
  UNIQUE (message_id, sender_name, emoji)
);

CREATE INDEX reactions_message_id
  ON public.reactions (message_id);

ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_public_select"
  ON public.reactions FOR SELECT USING (true);

CREATE POLICY "allow_public_insert"
  ON public.reactions FOR INSERT WITH CHECK (true);

CREATE POLICY "allow_public_delete"
  ON public.reactions FOR DELETE USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.reactions;

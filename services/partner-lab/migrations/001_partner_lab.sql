create schema if not exists partner_lab;
create extension if not exists pgcrypto;
create table if not exists partner_lab.deliveries(
 id uuid primary key default gen_random_uuid(), receiver text not null check(receiver in('analytics','advertising','crm')),
 merchant_id text not null, integration_id text not null, event_name text not null,
 received_fields jsonb not null, received_payload jsonb not null, request_id text not null unique,
 gateway_signature_valid boolean not null, gateway_timestamp timestamptz not null, received_at timestamptz not null default now()
);
create table if not exists partner_lab.replay_keys(request_id text primary key,expires_at timestamptz not null);
create index if not exists deliveries_receiver_time_idx on partner_lab.deliveries(receiver,received_at desc);
revoke all on schema partner_lab from public;revoke all on all tables in schema partner_lab from public;

alter table partner_lab.deliveries
  drop constraint if exists deliveries_receiver_check;

alter table partner_lab.deliveries
  add constraint deliveries_receiver_check
  check(receiver in('analytics','advertising','crm','managed-analytics','managed-delivery'));

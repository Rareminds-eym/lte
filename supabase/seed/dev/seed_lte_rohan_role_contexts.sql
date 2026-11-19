-- Local MBA context aliases reuse the published River Mission content.
BEGIN;
INSERT INTO public.roles(id,role_name,role_family_name,domain_name,metadata)
SELECT v.target_id::uuid,r.role_name,v.family_name,v.domain_name,r.metadata
FROM (VALUES
('a398dea7-2401-50be-bbe5-8d91fabf3c7d','bd7d949d-6c83-577e-b023-e62ed339ac74','Treatment Process Operations Support','Water Treatment and Utility Operations'),
('b439c97b-dcaf-59eb-9b4f-7e4411cc2e65','02693228-b44e-546c-8944-201455fddf45','Environmental Compliance Evidence','Environmental Compliance and Public Programmes')
) v(source_id,target_id,family_name,domain_name) JOIN public.roles r ON r.id=v.source_id::uuid
ON CONFLICT(id) DO NOTHING;
INSERT INTO public.role_capability_sequence(id,role_id,capability_id,sequence_step,capability_priority,required_level,duration_weeks,work_style_demands)
SELECT md5('rohan-context:'||v.target_id||':'||s.capability_id::text)::uuid,v.target_id::uuid,s.capability_id,s.sequence_step,s.capability_priority,s.required_level,s.duration_weeks,s.work_style_demands
FROM (VALUES
('a398dea7-2401-50be-bbe5-8d91fabf3c7d','bd7d949d-6c83-577e-b023-e62ed339ac74'),
('b439c97b-dcaf-59eb-9b4f-7e4411cc2e65','02693228-b44e-546c-8944-201455fddf45')
) v(source_id,target_id) JOIN public.role_capability_sequence s ON s.role_id=v.source_id::uuid
ON CONFLICT DO NOTHING;
COMMIT;

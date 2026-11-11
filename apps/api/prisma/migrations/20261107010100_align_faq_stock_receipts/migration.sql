-- M4: (1) FAQ gộp vào settings (khóa `faq`, JSON); (2) bỏ bảng suppliers, nhà cung cấp thành cột chữ trong phiếu kho.
-- Dữ liệu hiện có được chuyển trong cùng migration trước khi DROP.

-- (1) FAQ -> settings
INSERT INTO settings (key, value, description)
SELECT 'faq',
       coalesce(
         (SELECT jsonb_agg(
                   jsonb_build_object(
                     'key', t.key,
                     'label', t.label,
                     'items', coalesce(
                       (SELECT jsonb_agg(jsonb_build_object('question', i.question, 'answer', i.answer)
                                         ORDER BY i.sort_order, i.id)
                          FROM faq_items i WHERE i.topic_id = t.id),
                       '[]'::jsonb))
                   ORDER BY t.sort_order, t.id)
            FROM faq_topics t),
         '[]'::jsonb),
       'Câu hỏi thường gặp theo chủ đề: [{key, label, items:[{question, answer}]}]'
ON CONFLICT (key) DO NOTHING;
DROP TABLE faq_items;
DROP TABLE faq_topics;

-- (2) suppliers -> stock_receipts.supplier_name
ALTER TABLE stock_receipts ADD COLUMN supplier_name VARCHAR(150);
UPDATE stock_receipts r SET supplier_name = s.name FROM suppliers s WHERE s.id = r.supplier_id;
ALTER TABLE stock_receipts DROP CONSTRAINT fk_stock_receipts_supplier_id;
ALTER TABLE stock_receipts DROP COLUMN supplier_id;
DROP TABLE suppliers;
COMMENT ON COLUMN stock_receipts.supplier_name IS 'Tên nhà cung cấp (phiếu nhập), nhập tay';

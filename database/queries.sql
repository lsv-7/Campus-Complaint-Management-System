USE campuscare;
-- SELECT, WHERE, ORDER BY
SELECT id,title,status,priority FROM complaints WHERE status='Pending' ORDER BY created_at DESC;
-- INNER JOIN across normalized tables
SELECT c.id,c.title,u.name student,k.category_name FROM complaints c INNER JOIN users u ON u.id=c.user_id INNER JOIN categories k ON k.id=c.category_id;
-- LEFT JOIN retains empty categories
SELECT k.category_name,COUNT(c.id) total FROM categories k LEFT JOIN complaints c ON c.category_id=k.id GROUP BY k.id,k.category_name ORDER BY total DESC;
-- Aggregates / GROUP BY
SELECT status,COUNT(*) total FROM complaints GROUP BY status;
-- Subquery: students with more than one complaint
SELECT name,email FROM users WHERE role='student' AND id IN(SELECT user_id FROM complaints GROUP BY user_id HAVING COUNT(*)>1);
-- INSERT example (use valid existing IDs)
INSERT INTO complaints(user_id,category_id,title,description,location,priority) VALUES(1,1,'CampusCare SQL demo row','Temporary demonstration row','North campus','Medium');
SET @demo_complaint_id=LAST_INSERT_ID();
-- UPDATE example
UPDATE complaints SET status='In Progress' WHERE id=@demo_complaint_id;
-- DELETE only the row inserted immediately above
DELETE FROM complaints WHERE id=@demo_complaint_id;
-- Transaction pattern used by API for atomic status + history update
START TRANSACTION;
SELECT status FROM complaints WHERE id=1 FOR UPDATE;
UPDATE complaints SET status='Resolved' WHERE id=1;
INSERT INTO complaint_updates(complaint_id,admin_id,old_status,new_status,remarks) VALUES(1,1,'In Progress','Resolved','Work completed');
COMMIT;
-- View and stored procedure
SELECT * FROM complaint_summary ORDER BY created_at DESC;
CALL get_complaint_statistics();

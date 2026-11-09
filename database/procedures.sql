USE campuscare;
DELIMITER //
DROP PROCEDURE IF EXISTS get_complaint_statistics//
CREATE PROCEDURE get_complaint_statistics()
BEGIN
 SELECT COUNT(*) total,
 COALESCE(SUM(status='Pending'),0) pending,
 COALESCE(SUM(status='In Progress'),0) in_progress,
 COALESCE(SUM(status='Resolved'),0) resolved,
 COALESCE(SUM(status='Rejected'),0) rejected
 FROM complaints;
 SELECT k.category_name,COUNT(c.id) complaint_count
 FROM categories k LEFT JOIN complaints c ON c.category_id=k.id
 GROUP BY k.id,k.category_name ORDER BY complaint_count DESC;
END//
DELIMITER ;

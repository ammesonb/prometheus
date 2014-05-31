CREATE OR REPLACE FUNCTION delete_project(projID int) returns VOID AS
$$
DECLARE
    r record;
BEGIN
    DELETE FROM tasks * WHERE project=projID;
    IF EXISTS(SELECT * FROM projects WHERE parent=projID) THEN
        FOR r IN (SELECT id FROM projects  WHERE parent=projID)
        LOOP
            EXECUTE delete_project(r.id);
        END LOOP;
    END IF;
    DELETE FROM projects * WHERE id=projID;
END
$$
LANGUAGE 'plpgsql';

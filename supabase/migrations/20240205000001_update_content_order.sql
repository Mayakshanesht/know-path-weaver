-- Function to update content order in bulk
CREATE OR REPLACE FUNCTION update_content_order(updates JSON)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    update_item JSON;
BEGIN
    FOR update_item IN SELECT * FROM json_array_elements(updates)
    LOOP
        UPDATE capsule_content 
        SET order_index = (update_item->>'order_index')::int
        WHERE id = update_item->>'id';
    END LOOP;
END;
$$;

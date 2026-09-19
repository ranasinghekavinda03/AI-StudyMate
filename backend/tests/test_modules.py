def test_module_crud_and_isolation(client, auth_headers):
    headers, user = auth_headers

    # 1. Create a module
    create_res = client.post(
        "/api/v1/modules",
        headers=headers,
        json={
            "title": "Machine Learning",
            "code": "CS701",
            "description": "Supervised & Unsupervised Learning"
        }
    )
    assert create_res.status_code == 201
    module = create_res.json()
    module_id = module["id"]
    assert module["title"] == "Machine Learning"
    assert module["code"] == "CS701"

    # 2. List modules
    list_res = client.get("/api/v1/modules", headers=headers)
    assert list_res.status_code == 200
    modules = list_res.json()
    assert len(modules) == 1
    assert modules[0]["id"] == module_id

    # 3. Get single module
    get_res = client.get(f"/api/v1/modules/{module_id}", headers=headers)
    assert get_res.status_code == 200
    assert get_res.json()["title"] == "Machine Learning"

    # 4. Update module
    update_res = client.put(
        f"/api/v1/modules/{module_id}",
        headers=headers,
        json={"title": "Advanced Machine Learning"}
    )
    assert update_res.status_code == 200
    assert update_res.json()["title"] == "Advanced Machine Learning"

    # 5. Add a lecture to the module
    lec_res = client.post(
        "/api/v1/lectures",
        headers=headers,
        json={
            "module_id": module_id,
            "title": "Introduction to Neural Networks",
            "file_type": "pdf",
            "page_count": 24
        }
    )
    assert lec_res.status_code == 201
    lec_id = lec_res.json()["id"]

    # List lectures
    lec_list_res = client.get(f"/api/v1/lectures?module_id={module_id}", headers=headers)
    assert lec_list_res.status_code == 200
    assert len(lec_list_res.json()) == 1
    assert lec_list_res.json()[0]["id"] == lec_id

    # 6. Delete module
    del_res = client.delete(f"/api/v1/modules/{module_id}", headers=headers)
    assert del_res.status_code == 204

    # Verify module is gone
    get_after_del = client.get(f"/api/v1/modules/{module_id}", headers=headers)
    assert get_after_del.status_code == 404

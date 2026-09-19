def test_register_success(client):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Jane Doe",
            "email": "jane@example.com",
            "password": "SecurePassword123",
            "role": "student"
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "jane@example.com"
    assert data["user"]["name"] == "Jane Doe"


def test_register_duplicate_email(client):
    user_payload = {
        "name": "First User",
        "email": "duplicate@example.com",
        "password": "Password123"
    }
    res1 = client.post("/api/v1/auth/register", json=user_payload)
    assert res1.status_code == 201

    res2 = client.post("/api/v1/auth/register", json=user_payload)
    assert res2.status_code == 400
    assert "already exists" in res2.json()["detail"]


def test_login_success_and_profile(client):
    client.post(
        "/api/v1/auth/register",
        json={
            "name": "Login Tester",
            "email": "logintester@example.com",
            "password": "CorrectPassword"
        }
    )

    login_res = client.post(
        "/api/v1/auth/login",
        json={
            "email": "logintester@example.com",
            "password": "CorrectPassword"
        }
    )
    assert login_res.status_code == 200
    login_data = login_res.json()
    token = login_data["access_token"]
    refresh = login_data["refresh_token"]

    # Test /auth/me
    me_res = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert me_res.status_code == 200
    assert me_res.json()["email"] == "logintester@example.com"

    # Test /auth/refresh
    refresh_res = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh}
    )
    assert refresh_res.status_code == 200
    assert "access_token" in refresh_res.json()


def test_login_invalid_password(client):
    client.post(
        "/api/v1/auth/register",
        json={
            "name": "Password Tester",
            "email": "wrongpwd@example.com",
            "password": "CorrectPassword"
        }
    )

    login_res = client.post(
        "/api/v1/auth/login",
        json={
            "email": "wrongpwd@example.com",
            "password": "WrongPassword"
        }
    )
    assert login_res.status_code == 401

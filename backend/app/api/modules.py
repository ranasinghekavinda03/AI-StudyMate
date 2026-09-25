from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.module import Module
from app.models.lecture import Lecture
from app.schemas.module import ModuleCreate, ModuleUpdate, ModuleResponse
from app.services.upload_storage import collect_unshared_upload_paths, remove_upload_file

router = APIRouter(prefix="/modules", tags=["modules"])


@router.get("", response_model=List[ModuleResponse])
def get_modules(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    modules = db.query(Module).filter(Module.user_id == current_user.id).order_by(Module.created_at.desc()).all()
    results = []
    for mod in modules:
        lectures_count = db.query(Lecture).filter(Lecture.module_id == mod.id).count()
        mod_resp = ModuleResponse.model_validate(mod)
        mod_resp.lectures_count = lectures_count
        results.append(mod_resp)
    return results


@router.post("", response_model=ModuleResponse, status_code=status.HTTP_201_CREATED)
def create_module(
    module_in: ModuleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    module = Module(
        title=module_in.title,
        code=module_in.code,
        description=module_in.description,
        user_id=current_user.id,
    )
    db.add(module)
    db.commit()
    db.refresh(module)

    mod_resp = ModuleResponse.model_validate(module)
    mod_resp.lectures_count = 0
    return mod_resp


@router.get("/{module_id}", response_model=ModuleResponse)
def get_module(
    module_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    module = db.query(Module).filter(Module.id == module_id, Module.user_id == current_user.id).first()
    if not module:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Module not found."
        )

    lectures_count = db.query(Lecture).filter(Lecture.module_id == module.id).count()
    mod_resp = ModuleResponse.model_validate(module)
    mod_resp.lectures_count = lectures_count
    return mod_resp


@router.put("/{module_id}", response_model=ModuleResponse)
def update_module(
    module_id: str,
    module_in: ModuleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    module = db.query(Module).filter(Module.id == module_id, Module.user_id == current_user.id).first()
    if not module:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Module not found."
        )

    if module_in.title is not None:
        module.title = module_in.title
    if module_in.code is not None:
        module.code = module_in.code
    if module_in.description is not None:
        module.description = module_in.description

    db.commit()
    db.refresh(module)

    lectures_count = db.query(Lecture).filter(Lecture.module_id == module.id).count()
    mod_resp = ModuleResponse.model_validate(module)
    mod_resp.lectures_count = lectures_count
    return mod_resp


@router.delete("/{module_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_module(
    module_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    module = db.query(Module).filter(Module.id == module_id, Module.user_id == current_user.id).first()
    if not module:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Module not found."
        )

    module_file_urls = (
        file_url
        for (file_url,) in db.query(Lecture.file_url)
        .filter(Lecture.module_id == module.id, Lecture.file_url.isnot(None))
        .all()
    )
    surviving_file_urls = (
        file_url
        for (file_url,) in db.query(Lecture.file_url)
        .filter(Lecture.module_id != module.id, Lecture.file_url.isnot(None))
        .all()
    )
    cleanup_paths = collect_unshared_upload_paths(module_file_urls, surviving_file_urls)

    db.delete(module)
    db.commit()
    for path in cleanup_paths:
        remove_upload_file(path)
    return None

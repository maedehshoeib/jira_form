from app.models.job_description import JobDescription
from app.repositories.base import BaseRepository


class JobDescriptionRepository(BaseRepository):
    def list_all(self) -> list[JobDescription]:
        return (
            self.db.query(JobDescription)
            .order_by(
                JobDescription.organizational_unit,
                JobDescription.organizational_position,
                JobDescription.id.desc(),
            )
            .all()
        )

    def get(self, item_id: int) -> JobDescription | None:
        return self.db.get(JobDescription, item_id)

    def add(self, item: JobDescription) -> JobDescription:
        self.db.add(item)
        return item

    def delete(self, item: JobDescription) -> None:
        self.db.delete(item)

    def flush(self) -> None:
        self.db.flush()

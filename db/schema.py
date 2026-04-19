from sqlalchemy import (
    Column, Integer, Text, Float,
    TIMESTAMP, ForeignKey, func
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class RawFeedback(Base):
    __tablename__ = "raw_feedback"

    id = Column(Integer, primary_key=True, autoincrement=True)
    source = Column(Text, nullable=False)           # e.g. 'google_sheets'
    raw_text = Column(Text, nullable=False)         # original feedback text
    language = Column(Text)                         # detected language code e.g. 'en', 'hi'
    submitted_at = Column(TIMESTAMP)                # when user submitted feedback
    ingested_at = Column(TIMESTAMP, default=func.now())

    # Relationship
    cleaned = relationship("CleanedFeedback", back_populates="raw")


class CleanedFeedback(Base):
    __tablename__ = "cleaned_feedback"

    id = Column(Integer, primary_key=True, autoincrement=True)
    raw_id = Column(Integer, ForeignKey("raw_feedback.id"), nullable=False)
    original_language = Column(Text)                # language code before translation
    translated_text = Column(Text)                  # English translation (null if already English)
    cleaned_text = Column(Text, nullable=False)     # final cleaned English text
    sentiment = Column(Text)                        # positive / negative / neutral
    intent = Column(Text)                           # bug / feature_request / complaint / praise / question
    processed_at = Column(TIMESTAMP, default=func.now())

    # Relationships
    raw = relationship("RawFeedback", back_populates="cleaned")
    cluster_maps = relationship("FeedbackClusterMap", back_populates="cleaned")


class Cluster(Base):
    __tablename__ = "clusters"

    id = Column(Integer, primary_key=True, autoincrement=True)
    cluster_label = Column(Text, nullable=False)    # human-readable theme
    representative_text = Column(Text)              # best example from cluster
    feedback_count = Column(Integer, default=0)
    created_at = Column(TIMESTAMP, default=func.now())

    # Relationships
    feedback_maps = relationship("FeedbackClusterMap", back_populates="cluster")
    insights = relationship("Insight", back_populates="cluster")


class FeedbackClusterMap(Base):
    __tablename__ = "feedback_cluster_map"

    id = Column(Integer, primary_key=True, autoincrement=True)
    cleaned_id = Column(Integer, ForeignKey("cleaned_feedback.id"), nullable=False)
    cluster_id = Column(Integer, ForeignKey("clusters.id"), nullable=False)

    # Relationships
    cleaned = relationship("CleanedFeedback", back_populates="cluster_maps")
    cluster = relationship("Cluster", back_populates="feedback_maps")


class Insight(Base):
    __tablename__ = "insights"

    id = Column(Integer, primary_key=True, autoincrement=True)
    cluster_id = Column(Integer, ForeignKey("clusters.id"), nullable=False)
    root_cause = Column(Text)                       # why this problem exists
    recommendation = Column(Text)                   # what product team should do
    impact_score = Column(Float)                    # 0.0 - 1.0
    frequency_score = Column(Float)                 # 0.0 - 1.0
    severity_score = Column(Float)                  # 0.0 - 1.0
    confidence_score = Column(Float)                # 0.0 - 1.0
    priority_rank = Column(Integer)                 # 1 = highest priority
    evidence = Column(Text)                         # quoted feedback samples
    generated_at = Column(TIMESTAMP, default=func.now())

    # Relationship
    cluster = relationship("Cluster", back_populates="insights")
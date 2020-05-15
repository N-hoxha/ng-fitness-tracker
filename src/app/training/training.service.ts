import { Injectable } from '@angular/core';
import { Subject } from 'rxjs/Subject';
import { map, tap } from 'rxjs/operators';
import { AngularFirestore } from '@angular/fire/firestore';
import { Exercise } from './exercise.model';
@Injectable({ providedIn: 'root' })
export class TrainingService {
  exerciseChanged = new Subject<Exercise>();
  exercisesChanged = new Subject<Exercise[]>();
  finishedExercisesChanged = new Subject<Exercise[]>();

  private availableExercises: Exercise[] = [];
  private runningExercise: Exercise;

  constructor(private db: AngularFirestore) {}

  fetchAvailableExercises() {
    this.db
      .collection('availableExercises')
      .snapshotChanges()
      .pipe(
        map((docArray) => {
          return docArray.map((doc) => {
            return {
              id: doc.payload.doc.id,
              name: doc.payload.doc.data()['name'],
              duration: doc.payload.doc.data()['duration'],
              calories: doc.payload.doc.data()['calories'],
            };
          });
        }),
        tap((docArr) => console.log('service docArr', docArr))
      )
      .subscribe((exercises: Exercise[]) => {
        this.availableExercises = exercises;
        this.exercisesChanged.next([...this.availableExercises]);
      });
  }

  startExercise(selectedId: string) {
    this.runningExercise = this.availableExercises.find(
      (exercise) => exercise.id === selectedId
    );
    this.exerciseChanged.next({ ...this.runningExercise });
  }

  completeExercise() {
    this.addToDatabase({
      ...this.runningExercise,
      date: new Date(),
      state: 'completed',
    });
    this.runningExercise = null;
    this.exerciseChanged.next(null);
  }

  cancelExercise(progress: number) {
    this.addToDatabase({
      ...this.runningExercise,
      date: new Date(),
      state: 'cancelled',
      duration: this.runningExercise.duration * (progress / 100),
      calories: this.runningExercise.calories * (progress / 100),
    });
    this.runningExercise = null;
    this.exerciseChanged.next(null);
  }

  getRunningExercise() {
    return { ...this.runningExercise };
  }

  fetchCompletedOrCancelledExercises() {
    this.db
      .collection('finishedExercises')
      .valueChanges()
      .subscribe((exercises: Exercise[]) => {
        // firebase returns date in seconds and nanoseconds
        // => convert value into milliseconds on pipe in template
        console.log('fetchCompletedOrCancelledExercises', exercises);
        this.finishedExercisesChanged.next(exercises);
      });
  }

  addToDatabase(exercise: Exercise) {
    this.db
      .collection('finishedExercises')
      .add(exercise)
      .then((_) => console.log('Stored successfully in Firebase'))
      .catch((err) =>
        console.log(
          'Firebase Error on saving collection finishedExercises',
          err
        )
      );
  }
}

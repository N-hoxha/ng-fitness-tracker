import { Injectable } from '@angular/core';
import { Subject } from 'rxjs/Subject';
import { map } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { Store } from '@ngrx/store';

import { AngularFirestore } from '@angular/fire/firestore';
import { Exercise } from './exercise.model';
import { UIService } from '../shared/ui.service';
import * as fromApp from '../app.reducer';
import * as UI from '../shared/ui.actions';
@Injectable({ providedIn: 'root' })
export class TrainingService {
  exerciseChanged = new Subject<Exercise>();
  exercisesChanged = new Subject<Exercise[]>();
  finishedExercisesChanged = new Subject<Exercise[]>();
  fbSubs: Subscription[] = [];

  private availableExercises: Exercise[] = [];
  private runningExercise: Exercise;

  constructor(
    private db: AngularFirestore,
    private uiService: UIService,
    private store: Store<fromApp.State>
  ) {}

  fetchAvailableExercises() {
    this.store.dispatch(new UI.StartLoading());
    this.fbSubs.push(
      this.db
        .collection('availableExercises')
        .snapshotChanges()
        .pipe(
          map((docArray) => {
            // throw new Error();
            return docArray.map((doc) => {
              return {
                id: doc.payload.doc.id,
                name: doc.payload.doc.data()['name'],
                duration: doc.payload.doc.data()['duration'],
                calories: doc.payload.doc.data()['calories'],
              };
            });
          })
          // tap((docArr) => console.log('service docArr', docArr))
        )
        .subscribe(
          (exercises: Exercise[]) => {
            this.availableExercises = exercises;
            this.exercisesChanged.next([...this.availableExercises]);
            this.store.dispatch(new UI.StopLoading());
          },
          (err) => {
            console.log(err);
            this.uiService.showSnackbar(
              'Fetching Exercises failed, please try later.',
              null,
              3
            );
            this.store.dispatch(new UI.StopLoading());
          }
        )
    );
  }

  startExercise(selectedId: string) {
    // example how we can update fields, new fields are automatically created
    this.db
      .doc('availableExercises/' + selectedId)
      .update({ lastSelected: new Date() });

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
    this.fbSubs.push(
      this.db
        .collection('finishedExercises')
        .valueChanges()
        .subscribe(
          (exercises: Exercise[]) => {
            // firebase returns date in seconds and nanoseconds
            // => convert value into milliseconds on pipe in template
            // console.log('fetchCompletedOrCancelledExercises', exercises);
            this.finishedExercisesChanged.next(exercises);
          },
          (err) => {
            console.log(err);
          }
        )
    );
  }

  addToDatabase(exercise: Exercise) {
    this.db
      .collection('finishedExercises')
      .add(exercise)
      .then((_) =>
        console.log(`Exercise ${exercise.name} stored successfully in Firebase`)
      )
      .catch((err) =>
        console.log(`Firebase Error on saving exercise ${exercise.name}`, err)
      );
  }

  cancelSubscriptions() {
    this.fbSubs.forEach((sub: Subscription) => sub.unsubscribe());
  }
}

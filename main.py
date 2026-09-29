import os
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sb

import tensorflow as tf
from tensorflow import keras
from keras import layers
from sklearn.model_selection import train_test_split

import warnings
warnings.filterwarnings('ignore')

def main():
    print("=" * 60)
    print(" Fuel Efficiency Prediction using TensorFlow (Auto-MPG) ")
    print("=" * 60)

    csv_path = 'auto-mpg.csv'
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"Dataset not found at {csv_path}")

    # 1. Load Data
    print("\n[1] Loading dataset...")
    df = pd.read_csv(csv_path)
    print(f"Initial dataset shape: {df.shape}")
    print(df.head())

    # 2. Data Preprocessing & Cleaning
    print("\n[2] Data Preprocessing...")
    print(f"Records before cleaning: {df.shape[0]}")
    df = df[df['horsepower'] != '?']
    df['horsepower'] = df['horsepower'].astype(int)
    print(f"Records after removing '?' in horsepower: {df.shape[0]}")
    print(f"Missing values count:\n{df.isnull().sum()}")

    # Feature correlation & dropping redundant columns
    print("\nDropping 'displacement' due to high multicollinearity (> 0.9 with cylinders/weight)...")
    df.drop('displacement', axis=1, inplace=True)

    # 3. Train-Validation Split
    print("\n[3] Splitting features and target...")
    features = df.drop(['mpg', 'car name'], axis=1)
    target = df['mpg'].values

    print(f"Features used ({features.shape[1]}): {list(features.columns)}")
    X_train, X_val, Y_train, Y_val = train_test_split(
        features, target, test_size=0.2, random_state=22
    )
    print(f"Training set: {X_train.shape}, Validation set: {X_val.shape}")

    # 4. TensorFlow Data Pipeline
    print("\n[4] Building tf.data pipelines...")
    AUTO = tf.data.AUTOTUNE
    train_ds = (
        tf.data.Dataset
        .from_tensor_slices((X_train, Y_train))
        .batch(32)
        .prefetch(AUTO)
    )
    val_ds = (
        tf.data.Dataset
        .from_tensor_slices((X_val, Y_val))
        .batch(32)
        .prefetch(AUTO)
    )

    # 5. Model Architecture
    print("\n[5] Building Neural Network Model...")
    model = keras.Sequential([
        layers.Input(shape=(6,)),
        layers.Dense(256, activation='relu'),
        layers.BatchNormalization(),
        layers.Dense(256, activation='relu'),
        layers.Dropout(0.3),
        layers.BatchNormalization(),
        layers.Dense(1, activation='relu')
    ])

    model.compile(
        loss='mae',
        optimizer='adam',
        metrics=['mape']
    )
    model.summary()

    # 6. Model Training
    print("\n[6] Training model for 50 epochs...")
    history = model.fit(
        train_ds,
        epochs=50,
        validation_data=val_ds,
        verbose=1
    )

    # 7. Model Evaluation
    print("\n[7] Evaluating on validation set...")
    val_eval = model.evaluate(val_ds, verbose=0)
    print(f"Final Validation Loss (MAE): {val_eval[0]:.4f}")
    print(f"Final Validation MAPE: {val_eval[1]:.2f}%")

    # 8. Sample Predictions
    print("\n[8] Sample Predictions vs Actual MPG:")
    sample_features = X_val.iloc[:5]
    sample_actual = Y_val[:5]
    sample_preds = model.predict(sample_features).flatten()

    comparison_df = pd.DataFrame({
        'Actual MPG': sample_actual,
        'Predicted MPG': np.round(sample_preds, 2),
        'Difference': np.round(sample_preds - sample_actual, 2)
    })
    print(comparison_df.to_string(index=False))

    # 9. Save artifacts
    print("\n[9] Saving training curves and model...")
    os.makedirs('outputs', exist_ok=True)
    
    # Save training curves
    history_df = pd.DataFrame(history.history)
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))

    axes[0].plot(history_df['loss'], label='Train Loss (MAE)', color='#1f77b4', lw=2)
    axes[0].plot(history_df['val_loss'], label='Val Loss (MAE)', color='#ff7f0e', lw=2)
    axes[0].set_title('Loss (Mean Absolute Error) over Epochs')
    axes[0].set_xlabel('Epoch')
    axes[0].set_ylabel('MAE')
    axes[0].legend()
    axes[0].grid(True, linestyle='--', alpha=0.6)

    axes[1].plot(history_df['mape'], label='Train MAPE', color='#2ca02c', lw=2)
    axes[1].plot(history_df['val_mape'], label='Val MAPE', color='#d62728', lw=2)
    axes[1].set_title('MAPE (Mean Absolute Percentage Error) over Epochs')
    axes[1].set_xlabel('Epoch')
    axes[1].set_ylabel('MAPE (%)')
    axes[1].legend()
    axes[1].grid(True, linestyle='--', alpha=0.6)

    plt.tight_layout()
    plot_path = os.path.join('outputs', 'training_history.png')
    plt.savefig(plot_path, dpi=300)
    plt.close()
    print(f"Saved training plot to: {plot_path}")

    # Save model
    model_path = os.path.join('outputs', 'fuel_efficiency_model.keras')
    model.save(model_path)
    print(f"Saved model artifact to: {model_path}")

    print("\nExecution completed successfully!")

if __name__ == '__main__':
    main()

import mongoose, { Schema, type Model } from "mongoose";

export interface ISetting {
  key: string;
  value: unknown;
  updatedAt: Date;
  createdAt: Date;
}

const settingSchema = new Schema<ISetting>(
  {
    key: { type: String, required: true, unique: true },
    value: { type: Schema.Types.Mixed },
  },
  { collection: "settings", timestamps: true },
);

export const Setting: Model<ISetting> =
  (mongoose.models.Setting as Model<ISetting>) ??
  mongoose.model<ISetting>("Setting", settingSchema);

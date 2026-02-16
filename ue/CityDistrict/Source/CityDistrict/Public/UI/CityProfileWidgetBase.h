#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "CityProfileWidgetBase.generated.h"

class UButton;
class UTextBlock;
class UCityApiSubsystem;

UCLASS(Abstract, Blueprintable)
class CITYDISTRICT_API UCityProfileWidgetBase : public UUserWidget
{
    GENERATED_BODY()

public:
    virtual void NativeConstruct() override;

protected:
    UPROPERTY(meta = (BindWidgetOptional), BlueprintReadOnly)
    TObjectPtr<UButton> RefreshButton;

    UPROPERTY(meta = (BindWidgetOptional), BlueprintReadOnly)
    TObjectPtr<UTextBlock> NicknameText;

    UPROPERTY(meta = (BindWidgetOptional), BlueprintReadOnly)
    TObjectPtr<UTextBlock> BalanceText;

    UPROPERTY(meta = (BindWidgetOptional), BlueprintReadOnly)
    TObjectPtr<UTextBlock> SubscriptionText;

    UPROPERTY(meta = (BindWidgetOptional), BlueprintReadOnly)
    TObjectPtr<UTextBlock> GameRatingText;

    UPROPERTY(meta = (BindWidgetOptional), BlueprintReadOnly)
    TObjectPtr<UTextBlock> MlmRatingText;

    UPROPERTY(meta = (BindWidgetOptional), BlueprintReadOnly)
    TObjectPtr<UTextBlock> ErrorText;

    UFUNCTION()
    void HandleRefreshClicked();

    UFUNCTION()
    void HandleProfileLoaded(bool bSuccess, const FString& Nickname, float Balance, const FString& Subscription, const FString& ErrorMessage);

    UFUNCTION()
    void HandleRatingsLoaded(float GameRating, float MlmRating, const FString& ErrorMessage);

private:
    UCityApiSubsystem* GetApiSubsystem() const;
};

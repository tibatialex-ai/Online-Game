#include "UI/CityProfileWidgetBase.h"

#include "Components/Button.h"
#include "Components/TextBlock.h"
#include "Engine/GameInstance.h"
#include "Network/CityApiSubsystem.h"

void UCityProfileWidgetBase::NativeConstruct()
{
    Super::NativeConstruct();

    if (RefreshButton)
    {
        RefreshButton->OnClicked.AddDynamic(this, &UCityProfileWidgetBase::HandleRefreshClicked);
    }

    if (UCityApiSubsystem* Api = GetApiSubsystem())
    {
        Api->OnProfileLoaded.AddDynamic(this, &UCityProfileWidgetBase::HandleProfileLoaded);
        Api->OnRatingsLoaded.AddDynamic(this, &UCityProfileWidgetBase::HandleRatingsLoaded);
        Api->LoadCurrentUserProfile();
    }
}

void UCityProfileWidgetBase::HandleRefreshClicked()
{
    if (UCityApiSubsystem* Api = GetApiSubsystem())
    {
        Api->LoadCurrentUserProfile();
    }
}

void UCityProfileWidgetBase::HandleProfileLoaded(bool bSuccess, const FString& Nickname, float Balance, const FString& Subscription, const FString& ErrorMessage)
{
    if (bSuccess)
    {
        if (NicknameText)
        {
            NicknameText->SetText(FText::FromString(Nickname));
        }

        if (BalanceText)
        {
            BalanceText->SetText(FText::FromString(FString::Printf(TEXT("%.2f TOKEN"), Balance)));
        }

        if (SubscriptionText)
        {
            SubscriptionText->SetText(FText::FromString(Subscription));
        }

        if (ErrorText)
        {
            ErrorText->SetText(FText::GetEmpty());
        }
        return;
    }

    if (ErrorText)
    {
        ErrorText->SetText(FText::FromString(ErrorMessage));
    }
}

void UCityProfileWidgetBase::HandleRatingsLoaded(float GameRating, float MlmRating, const FString& ErrorMessage)
{
    if (!ErrorMessage.IsEmpty())
    {
        if (ErrorText)
        {
            ErrorText->SetText(FText::FromString(ErrorMessage));
        }
        return;
    }

    if (GameRatingText)
    {
        GameRatingText->SetText(FText::FromString(FString::Printf(TEXT("%.0f"), GameRating)));
    }

    if (MlmRatingText)
    {
        MlmRatingText->SetText(FText::FromString(FString::Printf(TEXT("%.0f"), MlmRating)));
    }
}

UCityApiSubsystem* UCityProfileWidgetBase::GetApiSubsystem() const
{
    return GetGameInstance() ? GetGameInstance()->GetSubsystem<UCityApiSubsystem>() : nullptr;
}
